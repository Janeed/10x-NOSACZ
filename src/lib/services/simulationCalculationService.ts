import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import type { SimulationStatus } from "../../types.ts";
import { logger } from "../logger.ts";
import {
  computeProjectedPayoffMonth as sharedComputeProjectedPayoffMonth,
  deriveStandardMonthlyPayment,
  generateBaselineProjection,
} from "./simulationSharedService.ts";

type SimulationRow = Database["public"]["Tables"]["simulations"]["Row"];
type LoanRow = Database["public"]["Tables"]["loans"]["Row"];
type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];

type Supabase = SupabaseClient<Database>;

export interface SimulationComputeOptions {
  requestId?: string;
}

export interface SimulationComputationContext {
  simulation: SimulationRow;
  loans: LoanRow[];
  userSettings: UserSettingsRow | null;
}

export interface BaselineSchedule {
  monthsToPayoff: number;
  monthlyPaymentTotal: number;
  totalInterest: number;
  totalPrincipal: number;
}

export interface StrategyComputationResult {
  monthsToPayoff: number;
  monthlyPaymentTotal: number;
  totalInterestSaved: number;
  projectedPayoffMonth: string;
  reductionFactor: number;
}

export interface SimulationMetrics {
  baselineInterest: number;
  totalInterestSaved: number;
  projectedMonthsToPayoff: number;
  projectedPayoffMonth: string;
  monthlyPaymentTotal: number;
}

export interface LoanSnapshotDraft {
  loanId: string;
  simulationId: string;
  userId: string;
  remainingTermMonths: number;
  startingBalance: number;
  startingMonth: string;
  startingRate: number;
}

const DEFAULT_BASELINE_MONTHS = 36;
const MIN_MONTHS = 1;
const STRATEGY_REDUCTION_MAP: Record<string, number> = {
  avalanche: 0.1,
  snowball: 0.08,
  equal: 0.05,
  ratio: 0.05,
};
const FALLBACK_REDUCTION = 0.04;

const withLogContext = (
  base: Record<string, unknown>,
  options?: SimulationComputeOptions,
): Record<string, unknown> => {
  if (!options?.requestId) {
    return base;
  }

  return { ...base, requestId: options.requestId };
};

const captureErrorDetails = (
  error: unknown,
): { errorName: string; errorMessage: string } => {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }

  return {
    errorName: "UnknownError",
    errorMessage: typeof error === "string" ? error : JSON.stringify(error),
  };
};

// Date and month utilities are now imported from simulationSharedService
// deriveStandardMonthlyPayment is now imported from simulationSharedService
// computeProjectedPayoffMonth is now imported from simulationSharedService

export const scheduleSimulationComputation = (
  supabase: Supabase,
  simulationId: string,
  userId: string,
  options?: SimulationComputeOptions,
): void => {
  queueMicrotask(() => {
    void computeAndPersist(supabase, simulationId, userId, options).catch(
      (error) => {
        const details = captureErrorDetails(error);
        logger.error(
          "simulation_compute_unhandled",
          "Unhandled error during simulation compute",
          withLogContext({ ...details, simulationId, userId }, options),
        );
      },
    );
  });
};

export const retrySimulationIfErrored = async (
  supabase: Supabase,
  simulation: SimulationRow,
  options?: SimulationComputeOptions,
): Promise<boolean> => {
  if (simulation.status !== "error") {
    return false;
  }

  const { data, error } = await supabase
    .from("simulations")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", simulation.id)
    .eq("user_id", simulation.user_id)
    .eq("status", "error")
    .select("id")
    .maybeSingle();

  if (error) {
    logger.error(
      "simulation_compute_retry_failed",
      "Failed to reset simulation status for retry",
      withLogContext(
        {
          simulationId: simulation.id,
          userId: simulation.user_id,
          ...captureErrorDetails(error),
        },
        options,
      ),
    );
    return false;
  }

  if (!data) {
    logger.debug(
      "simulation_compute_retry_skipped",
      "Skip retry because status update did not match any rows",
      withLogContext(
        { simulationId: simulation.id, userId: simulation.user_id },
        options,
      ),
    );
    return false;
  }

  logger.info(
    "simulation_compute_retry",
    "Retrying simulation computation",
    withLogContext(
      { simulationId: simulation.id, userId: simulation.user_id },
      options,
    ),
  );

  scheduleSimulationComputation(
    supabase,
    simulation.id,
    simulation.user_id,
    options,
  );
  return true;
};

export const loadSimulationContext = async (
  supabase: Supabase,
  simulationId: string,
  userId: string,
): Promise<SimulationComputationContext> => {
  const { data: simulation, error: simulationError } = await supabase
    .from("simulations")
    .select("*")
    .eq("id", simulationId)
    .eq("user_id", userId)
    .single();

  if (simulationError) {
    throw new Error(
      `Failed to load simulation ${simulationId}: ${simulationError.message}`,
    );
  }

  if (simulation.status !== "running") {
    return {
      simulation,
      loans: [],
      userSettings: null,
    };
  }

  const { data: loans, error: loanError } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", userId)
    .eq("is_closed", false);

  if (loanError) {
    throw new Error(
      `Failed to load loans for simulation ${simulationId}: ${loanError.message}`,
    );
  }

  const { data: userSettings, error: settingsError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsError) {
    throw new Error(
      `Failed to load user settings for simulation ${simulationId}: ${settingsError.message}`,
    );
  }

  return {
    simulation,
    loans: loans ?? [],
    userSettings: userSettings ?? null,
  };
};

export const computeBaselineSchedule = (
  context: SimulationComputationContext,
): BaselineSchedule => {
  if (context.loans.length === 0) {
    return {
      monthsToPayoff: 0,
      monthlyPaymentTotal: 0,
      totalInterest: 0,
      totalPrincipal: 0,
    };
  }

  const totalPrincipal = context.loans.reduce(
    (sum, loan) => sum + loan.remaining_balance,
    0,
  );

  const monthsCandidates = context.loans
    .map((loan) => loan.term_months)
    .filter((term) => Number.isFinite(term) && term > 0);

  const monthsToPayoff = monthsCandidates.length
    ? Math.max(...monthsCandidates)
    : DEFAULT_BASELINE_MONTHS;

  const monthlyPaymentTotal = context.loans.reduce(
    (sum, loan) =>
      sum +
      deriveStandardMonthlyPayment(
        loan.remaining_balance,
        loan.annual_rate,
        loan.term_months,
      ),
    0,
  );

  const totalInterest = Math.max(
    0,
    monthlyPaymentTotal * monthsToPayoff - totalPrincipal,
  );

  return {
    monthsToPayoff,
    monthlyPaymentTotal,
    totalInterest,
    totalPrincipal,
  };
};

export const applyStrategy = (
  context: SimulationComputationContext,
  baseline: BaselineSchedule,
): StrategyComputationResult => {
  const reductionFactor =
    STRATEGY_REDUCTION_MAP[context.simulation.strategy] ?? FALLBACK_REDUCTION;

  if (baseline.monthsToPayoff <= 0) {
    const projectedPayoffMonth = sharedComputeProjectedPayoffMonth(
      context.simulation.started_at ?? context.simulation.created_at,
      0,
    );

    return {
      monthsToPayoff: 0,
      monthlyPaymentTotal:
        baseline.monthlyPaymentTotal +
        context.simulation.monthly_overpayment_limit,
      totalInterestSaved: 0,
      projectedPayoffMonth,
      reductionFactor,
    };
  }

  const adjustedMonths = Math.max(
    MIN_MONTHS,
    Math.round(baseline.monthsToPayoff * (1 - reductionFactor)),
  );

  const totalInterestSaved = baseline.totalInterest * reductionFactor;
  const projectedPayoffMonth = sharedComputeProjectedPayoffMonth(
    context.simulation.started_at ?? context.simulation.created_at,
    adjustedMonths,
  );

  return {
    monthsToPayoff: adjustedMonths,
    monthlyPaymentTotal:
      baseline.monthlyPaymentTotal +
      context.simulation.monthly_overpayment_limit,
    totalInterestSaved,
    projectedPayoffMonth,
    reductionFactor,
  };
};

export const aggregateMetrics = (
  baseline: BaselineSchedule,
  strategyResult: StrategyComputationResult,
): SimulationMetrics => {
  return {
    baselineInterest: baseline.totalInterest,
    totalInterestSaved: strategyResult.totalInterestSaved,
    projectedMonthsToPayoff: strategyResult.monthsToPayoff,
    projectedPayoffMonth: strategyResult.projectedPayoffMonth,
    monthlyPaymentTotal: strategyResult.monthlyPaymentTotal,
  };
};

export const buildLoanSnapshots = (
  context: SimulationComputationContext,
  strategyResult: StrategyComputationResult,
): LoanSnapshotDraft[] => {
  if (context.loans.length === 0) {
    return [];
  }

  const fallbackStartMonth = sharedComputeProjectedPayoffMonth(
    context.simulation.started_at ?? context.simulation.created_at,
    0,
  );

  return context.loans.map((loan) => {
    const reducedTerm = Math.max(
      MIN_MONTHS,
      Math.round(loan.term_months * (1 - strategyResult.reductionFactor)),
    );

    return {
      loanId: loan.id,
      simulationId: context.simulation.id,
      userId: context.simulation.user_id,
      remainingTermMonths: reducedTerm,
      startingBalance: loan.remaining_balance,
      startingMonth: loan.start_month ?? fallbackStartMonth,
      startingRate: loan.annual_rate,
    };
  });
};

export const persistSnapshots = async (
  supabase: Supabase,
  simulationId: string,
  userId: string,
  snapshots: LoanSnapshotDraft[],
): Promise<void> => {
  const { error: deleteError } = await supabase
    .from("simulation_loan_snapshots")
    .delete()
    .eq("simulation_id", simulationId)
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(
      `Failed to clear existing loan snapshots: ${deleteError.message}`,
    );
  }

  if (snapshots.length === 0) {
    return;
  }

  const payload = snapshots.map((snapshot) => ({
    simulation_id: snapshot.simulationId,
    loan_id: snapshot.loanId,
    user_id: snapshot.userId,
    remaining_term_months: snapshot.remainingTermMonths,
    starting_balance: snapshot.startingBalance,
    starting_month: snapshot.startingMonth,
    starting_rate: snapshot.startingRate,
  }));

  const { error: insertError } = await supabase
    .from("simulation_loan_snapshots")
    .insert(payload);

  if (insertError) {
    throw new Error(`Failed to persist loan snapshots: ${insertError.message}`);
  }
};

export const persistHistoryMetric = async (
  supabase: Supabase,
  context: SimulationComputationContext,
  metrics: SimulationMetrics,
): Promise<void> => {
  const { simulation } = context;

  const { error: deleteError } = await supabase
    .from("simulation_history_metrics")
    .delete()
    .eq("simulation_id", simulation.id)
    .eq("user_id", simulation.user_id);

  if (deleteError) {
    throw new Error(`Failed to clear history metrics: ${deleteError.message}`);
  }

  const capturedAt = new Date().toISOString();
  const { error: insertError } = await supabase
    .from("simulation_history_metrics")
    .insert({
      simulation_id: simulation.id,
      user_id: simulation.user_id,
      goal: simulation.goal,
      strategy: simulation.strategy,
      captured_at: capturedAt,
      baseline_interest: metrics.baselineInterest,
      total_interest_saved: metrics.totalInterestSaved,
      monthly_payment_total: metrics.monthlyPaymentTotal,
      months_to_payoff: metrics.projectedMonthsToPayoff,
      payoff_month: metrics.projectedPayoffMonth,
    });

  if (insertError) {
    throw new Error(
      `Failed to persist history metrics: ${insertError.message}`,
    );
  }
};

export const finalizeSuccess = async (
  supabase: Supabase,
  simulationId: string,
  metrics: SimulationMetrics,
): Promise<SimulationStatus | null> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("simulations")
    .update({
      status: "completed",
      completed_at: nowIso,
      baseline_interest: metrics.baselineInterest,
      total_interest_saved: metrics.totalInterestSaved,
      projected_months_to_payoff: metrics.projectedMonthsToPayoff,
      projected_payoff_month: metrics.projectedPayoffMonth,
    })
    .eq("id", simulationId)
    .eq("status", "running")
    .select("status")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to finalize simulation success: ${error.message}`);
  }

  return data?.status ?? null;
};

export const finalizeError = async (
  supabase: Supabase,
  simulationId: string,
  error: unknown,
): Promise<SimulationStatus | null> => {
  const failureDetails = captureErrorDetails(error);
  const { data, error: updateError } = await supabase
    .from("simulations")
    .update({
      status: "error",
      completed_at: null,
    })
    .eq("id", simulationId)
    .eq("status", "running")
    .select("status")
    .maybeSingle();

  if (updateError) {
    throw new Error(
      `Failed to mark simulation as error: ${updateError.message}`,
    );
  }

  if (data?.status === "error") {
    logger.warn("simulation_finalize_error", "Simulation marked as error", {
      simulationId,
      ...failureDetails,
    });
  }

  return data?.status ?? null;
};

export const computeAndPersist = async (
  supabase: Supabase,
  simulationId: string,
  userId: string,
  options?: SimulationComputeOptions,
): Promise<void> => {
  logger.info(
    "simulation_compute_start",
    "Starting simulation computation",
    withLogContext({ simulationId, userId }, options),
  );

  try {
    const context = await loadSimulationContext(supabase, simulationId, userId);

    if (context.simulation.status !== "running") {
      logger.info(
        "simulation_compute_skip_status",
        "Skipping computation because simulation is not running",
        withLogContext(
          {
            simulationId,
            userId,
            status: context.simulation.status,
          },
          options,
        ),
      );
      return;
    }

    const baseline = computeBaselineSchedule(context);
    const strategyResult = applyStrategy(context, baseline);
    const metrics = aggregateMetrics(baseline, strategyResult);
    const snapshots = buildLoanSnapshots(context, strategyResult);

    await persistSnapshots(supabase, simulationId, userId, snapshots);
    await persistHistoryMetric(supabase, context, metrics);
    await finalizeSuccess(supabase, simulationId, metrics);

    logger.info(
      "simulation_compute_success",
      "Simulation computation completed",
      withLogContext({ simulationId, userId }, options),
    );
  } catch (error) {
    const details = captureErrorDetails(error);
    logger.error(
      "simulation_compute_failed",
      "Simulation computation failed",
      withLogContext({ simulationId, userId, ...details }, options),
    );

    try {
      await finalizeError(supabase, simulationId, error);
    } catch (finalizeErrorCause) {
      const finalizeDetails = captureErrorDetails(finalizeErrorCause);
      logger.error(
        "simulation_finalize_error_failed",
        "Failed to mark simulation as error",
        withLogContext({ simulationId, userId, ...finalizeDetails }, options),
      );
    }
  }
};

export const generateProjectionTimeline = (
  simulationContext: SimulationComputationContext,
  options?: { maxMonths?: number; now?: Date },
): {
  month: string;
  principal: number;
  interest: number;
  remaining: number;
}[] => {
  const maxMonths = options?.maxMonths || 120;
  const now = options?.now || new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth();

  if (simulationContext.loans.length === 0) return [];

  // Use shared baseline projection with overpayment split evenly
  const additionalPaymentPerLoan =
    simulationContext.simulation.monthly_overpayment_limit /
    simulationContext.loans.length;

  const projection = generateBaselineProjection(
    simulationContext.loans,
    startYear,
    startMonth,
    maxMonths,
    additionalPaymentPerLoan,
  );

  // Map to expected return format
  return projection.map((entry) => ({
    month: entry.month,
    principal: entry.principal,
    interest: entry.interest,
    remaining: entry.remaining,
  }));
};
