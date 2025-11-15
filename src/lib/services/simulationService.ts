import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import type {
  SimulationListQuery,
  SimulationListResponse,
  CreateSimulationCommand,
  SimulationQueuedResponse,
  SimulationDetailDto,
  SimulationActivationResponse,
  SimulationCancelResponse,
  SimulationDto,
  SimulationLoanSnapshotDto,
  SimulationHistoryMetricDto,
} from "../../types.ts";
import {
  conflictError,
  internalError,
  notFoundError,
  validationError,
} from "../errors.ts";
import { logger } from "../logger.ts";

type SimulationDetailQuery = { include?: string[] };

type ActiveSimulationDashboardDto = SimulationDetailDto & {
  currentMonthSchedule: {
    monthStart: Date;
    entries: Array<{
      loanId: string;
      scheduledPayment: number;
      scheduledOverpayment: number;
      paymentStatus: string;
      overpaymentStatus: string;
    }>;
  };
};

type SupabaseErrorPayload = { code: string; message: string } | null;

const withSupabaseError = (
  error: SupabaseErrorPayload,
): Record<string, string> | undefined => {
  if (!error) {
    return undefined;
  }

  return {
    supabaseCode: error.code,
    supabaseMessage: error.message,
  };
};

const assertSupabaseClient = (
  supabase: SupabaseClient<Database> | undefined,
): SupabaseClient<Database> => {
  if (!supabase) {
    throw internalError(
      "SUPABASE_CLIENT_MISSING",
      "Supabase client is not available",
    );
  }

  return supabase;
};

const assertUserId = (userId: string | undefined): string => {
  if (!userId) {
    throw internalError(
      "USER_IDENTIFIER_MISSING",
      "User identifier is required to update simulations",
    );
  }

  return userId;
};

export const markActiveSimulationStale = async (
  supabaseClient: SupabaseClient<Database> | undefined,
  userId: string | undefined,
): Promise<boolean> => {
  const supabase = assertSupabaseClient(supabaseClient);
  const resolvedUserId = assertUserId(userId);

  let result;
  try {
    result = await supabase
      .from("simulations")
      .update({ stale: true })
      .eq("user_id", resolvedUserId)
      .eq("is_active", true)
      .eq("stale", false)
      .select("id");
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to mark simulations as stale",
      { cause },
    );
  }

  const { data, error } = result;

  if (error) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to mark simulations as stale",
      {
        cause: error,
        details: withSupabaseError(error),
      },
    );
  }

  if (!data) {
    return false;
  }

  return Array.isArray(data) ? data.length > 0 : true;
};

export const listSimulations = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  query: SimulationListQuery,
): Promise<SimulationListResponse> => {
  const {
    status,
    isActive,
    stale,
    page = 1,
    pageSize = 20,
    sort = "created_at",
    order = "desc",
  } = query;

  let selectQuery = supabase
    .from("simulations")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  if (status) {
    selectQuery = selectQuery.eq("status", status);
  }
  if (isActive !== undefined) {
    selectQuery = selectQuery.eq("is_active", isActive);
  }
  if (stale !== undefined) {
    selectQuery = selectQuery.eq("stale", stale);
  }

  selectQuery = selectQuery.order(sort, { ascending: order === "asc" });

  const offset = (page - 1) * pageSize;
  selectQuery = selectQuery.range(offset, offset + pageSize - 1);

  const { data, error, count } = await selectQuery;

  if (error) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to fetch simulations",
      {
        cause: error,
        details: withSupabaseError(error),
      },
    );
  }

  if (!data) {
    throw internalError("SUPABASE_ERROR", "No data returned from simulations query");
  }

  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const items: SimulationDto[] = data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    strategy: row.strategy,
    goal: row.goal,
    status: row.status,
    isActive: row.is_active,
    stale: row.stale,
    monthlyOverpaymentLimit: row.monthly_overpayment_limit,
    paymentReductionTarget: row.payment_reduction_target,
    reinvestReducedPayments: row.reinvest_reduced_payments,
    baselineInterest: row.baseline_interest,
    totalInterestSaved: row.total_interest_saved,
    projectedMonthsToPayoff: row.projected_months_to_payoff,
    projectedPayoffMonth: row.projected_payoff_month,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    notes: row.notes,
  }));

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
  };
};

export const queueSimulation = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  cmd: CreateSimulationCommand,
): Promise<SimulationQueuedResponse> => {
  // Check for existing running simulation and cancel it
  const { data: runningSimulations, error: fetchError } = await supabase
    .from("simulations")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "running");

  if (fetchError) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to check for running simulations",
      {
        cause: fetchError,
        details: withSupabaseError(fetchError),
      },
    );
  }

  if (runningSimulations && runningSimulations.length > 0) {
    // Cancel existing running simulation
    const { error: cancelError } = await supabase
      .from("simulations")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "running");

    if (cancelError) {
      throw conflictError(
        "PRIOR_SIMULATION_CANCEL_FAILED",
        "Failed to cancel prior running simulation",
        {
          cause: cancelError,
          details: withSupabaseError(cancelError),
        },
      );
    }

    logger.info("simulation_queue_cancel_previous", "Cancelled previous running simulation", {
      userId,
      previousSimulationId: runningSimulations[0].id,
      requestId: "N/A", // TODO: pass requestId if available
    });
  }

  // Load user settings if monthlyOverpaymentLimit not provided
  let monthlyOverpaymentLimit = cmd.monthlyOverpaymentLimit;
  if (monthlyOverpaymentLimit === undefined) {
    const { data: userSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("monthly_overpayment_limit")
      .eq("user_id", userId)
      .single();

    if (settingsError) {
      throw internalError(
        "SUPABASE_ERROR",
        "Failed to load user settings",
        {
          cause: settingsError,
          details: withSupabaseError(settingsError),
        },
      );
    }

    monthlyOverpaymentLimit = userSettings.monthly_overpayment_limit;
  }

  // Insert new simulation
  const insertData = {
    user_id: userId,
    strategy: cmd.strategy,
    goal: cmd.goal,
    reinvest_reduced_payments: cmd.reinvestReducedPayments,
    monthly_overpayment_limit: monthlyOverpaymentLimit,
    payment_reduction_target: cmd.paymentReductionTarget,
    notes: cmd.notes,
    status: "running" as const,
    is_active: false,
    stale: false,
    created_at: new Date().toISOString(),
  };

  const { data: newSimulation, error: insertError } = await supabase
    .from("simulations")
    .insert(insertData)
    .select("id, created_at")
    .single();

  if (insertError) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to queue simulation",
      {
        cause: insertError,
        details: withSupabaseError(insertError),
      },
    );
  }

  logger.info("simulation_queue_requested", "Simulation queued", {
    simulationId: newSimulation.id,
    userId,
    strategy: cmd.strategy,
    goal: cmd.goal,
    requestId: "N/A", // TODO: pass requestId
  });

  return {
    simulationId: newSimulation.id,
    status: "running",
    isActive: false,
    queuedAt: newSimulation.created_at,
  };
};

export const getSimulationDetail = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
  include?: string[],
): Promise<SimulationDetailDto> => {
  // Fetch simulation
  const { data: simulation, error: simError } = await supabase
    .from("simulations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (simError) {
    if (simError.code === "PGRST116") { // Not found
      throw notFoundError("SIMULATION_NOT_FOUND", "Simulation not found");
    }
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to fetch simulation",
      {
        cause: simError,
        details: withSupabaseError(simError),
      },
    );
  }

  const baseDto: SimulationDto = {
    id: simulation.id,
    userId: simulation.user_id,
    strategy: simulation.strategy,
    goal: simulation.goal,
    status: simulation.status,
    isActive: simulation.is_active,
    stale: simulation.stale,
    monthlyOverpaymentLimit: simulation.monthly_overpayment_limit,
    paymentReductionTarget: simulation.payment_reduction_target,
    reinvestReducedPayments: simulation.reinvest_reduced_payments,
    baselineInterest: simulation.baseline_interest,
    totalInterestSaved: simulation.total_interest_saved,
    projectedMonthsToPayoff: simulation.projected_months_to_payoff,
    projectedPayoffMonth: simulation.projected_payoff_month,
    createdAt: simulation.created_at,
    startedAt: simulation.started_at,
    completedAt: simulation.completed_at,
    cancelledAt: simulation.cancelled_at,
    notes: simulation.notes,
  };

  let loanSnapshots: SimulationLoanSnapshotDto[] | undefined;
  if (include?.includes("loanSnapshots")) {
    const { data: snapshots, error: snapError } = await supabase
      .from("simulation_loan_snapshots")
      .select("*")
      .eq("simulation_id", id)
      .eq("user_id", userId);

    if (snapError) {
      throw internalError(
        "SUPABASE_ERROR",
        "Failed to fetch simulation loan snapshots",
        {
          cause: snapError,
          details: withSupabaseError(snapError),
        },
      );
    }

    loanSnapshots = snapshots?.map((s) => ({
      id: s.id,
      simulationId: s.simulation_id,
      loanId: s.loan_id,
      remainingTermMonths: s.remaining_term_months,
      startingBalance: s.starting_balance,
      startingMonth: s.starting_month,
      startingRate: s.starting_rate,
      userId: s.user_id,
    }));
  }

  // Fetch latest history metric
  const { data: latestMetric, error: metricError } = await supabase
    .from("simulation_history_metrics")
    .select("*")
    .eq("simulation_id", id)
    .eq("user_id", userId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .single();

  let historyMetrics: SimulationHistoryMetricDto[] | undefined;
  if (latestMetric && !metricError) {
    historyMetrics = [{
      id: latestMetric.id,
      simulationId: latestMetric.simulation_id,
      userId: latestMetric.user_id,
      goal: latestMetric.goal,
      strategy: latestMetric.strategy,
      capturedAt: latestMetric.captured_at,
      baselineInterest: latestMetric.baseline_interest,
      totalInterestSaved: latestMetric.total_interest_saved,
      monthlyPaymentTotal: latestMetric.monthly_payment_total,
      monthsToPayoff: latestMetric.months_to_payoff,
      payoffMonth: latestMetric.payoff_month,
    }];
  } else if (metricError && metricError.code !== "PGRST116") {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to fetch simulation history metrics",
      {
        cause: metricError,
        details: withSupabaseError(metricError),
      },
    );
  }

  return {
    ...baseDto,
    loanSnapshots,
    historyMetrics,
    monthlyPaymentTotal: latestMetric?.monthly_payment_total,
    monthsToPayoff: latestMetric?.months_to_payoff,
    payoffMonth: latestMetric?.payoff_month,
  };
};

export const activateSimulation = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
): Promise<SimulationActivationResponse> => {
  // Fetch target simulation
  const { data: targetSim, error: fetchError } = await supabase
    .from("simulations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw notFoundError("SIMULATION_NOT_FOUND", "Simulation not found");
    }
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to fetch simulation",
      {
        cause: fetchError,
        details: withSupabaseError(fetchError),
      },
    );
  }

  // Validate status
  if (targetSim.status !== "completed") {
    throw validationError("SIMULATION_NOT_COMPLETED", "Simulation must be completed to activate");
  }

  if (targetSim.stale) {
    throw validationError("SIMULATION_STALE", "Cannot activate stale simulation");
  }

  // Clear previous active simulation
  const { error: clearError } = await supabase
    .from("simulations")
    .update({ is_active: false, status: "completed" })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (clearError) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to clear previous active simulation",
      {
        cause: clearError,
        details: withSupabaseError(clearError),
      },
    );
  }

  // Set target as active
  const { error: activateError } = await supabase
    .from("simulations")
    .update({ is_active: true, status: "active" })
    .eq("id", id)
    .eq("user_id", userId);

  if (activateError) {
    // Check if unique constraint violation (assuming it's a conflict)
    if (activateError.code === "23505") { // Unique violation
      // Retry once: refetch and try again
      const { error: retryError } = await supabase
        .from("simulations")
        .update({ is_active: true, status: "active" })
        .eq("id", id)
        .eq("user_id", userId);

      if (retryError) {
        throw conflictError("ACTIVE_CONFLICT", "Failed to activate simulation due to conflict");
      }
    } else {
      throw internalError(
        "SUPABASE_ERROR",
        "Failed to activate simulation",
        {
          cause: activateError,
          details: withSupabaseError(activateError),
        },
      );
    }
  }

  logger.info("simulation_activate", "Simulation activated", {
    simulationId: id,
    userId,
    requestId: "N/A",
  });

  // Return the activated simulation detail
  return await getSimulationDetail(supabase, userId, id);
};

export const cancelSimulation = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
): Promise<SimulationCancelResponse> => {
  // Fetch simulation
  const { data: simulation, error: fetchError } = await supabase
    .from("simulations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw notFoundError("SIMULATION_NOT_FOUND", "Simulation not found");
    }
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to fetch simulation",
      {
        cause: fetchError,
        details: withSupabaseError(fetchError),
      },
    );
  }

  // Check status
  if (simulation.status !== "running") {
    throw conflictError("SIMULATION_CANCEL_CONFLICT", "Simulation is not running and cannot be cancelled");
  }

  // Update to cancelled
  const { error: updateError } = await supabase
    .from("simulations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to cancel simulation",
      {
        cause: updateError,
        details: withSupabaseError(updateError),
      },
    );
  }

  logger.info("simulation_cancel", "Simulation cancelled", {
    simulationId: id,
    userId,
    requestId: "N/A",
  });

  // Return cancelled simulation detail
  return await getSimulationDetail(supabase, userId, id);
};

export const getActiveSimulationDashboard = async (
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ActiveSimulationDashboardDto> => {
  // Fetch active simulation
  const { data: activeSim, error: fetchError } = await supabase
    .from("simulations")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw notFoundError("ACTIVE_NOT_FOUND", "No active simulation found");
    }
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to fetch active simulation",
      {
        cause: fetchError,
        details: withSupabaseError(fetchError),
      },
    );
  }

  // Check if stale
  if (activeSim.stale) {
    throw notFoundError("ACTIVE_SIMULATION_STALE", "Active simulation is stale");
  }

  // Get detail with loan snapshots
  const detail = await getSimulationDetail(supabase, userId, activeSim.id, ["loanSnapshots"]);

  // Compute current month schedule (placeholder algorithm)
  const currentMonth = new Date();
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

  let scheduleEntries: Array<{
    loanId: string;
    scheduledPayment: number;
    scheduledOverpayment: number;
    paymentStatus: string;
    overpaymentStatus: string;
  }> = [];

  if (detail.loanSnapshots) {
    // Placeholder: for each loan, assume fixed payment and overpayment
    // In real implementation, this would use amortization calculations
    scheduleEntries = detail.loanSnapshots.map((snapshot) => ({
      loanId: snapshot.loanId,
      scheduledPayment: 100, // Stub value
      scheduledOverpayment: 50, // Stub value
      paymentStatus: "scheduled", // Stub
      overpaymentStatus: "scheduled", // Stub
    }));
  }

  return {
    ...detail,
    currentMonthSchedule: {
      monthStart,
      entries: scheduleEntries,
    },
  };
};
