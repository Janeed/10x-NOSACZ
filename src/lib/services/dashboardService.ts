import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import type {
  ActiveSimulationSummary,
  DashboardOverviewDto,
  DashboardOverviewCurrentMonth,
  DashboardOverviewGraphData,
  DashboardOverviewAdherence,
} from "../../types.ts";
import { internalError } from "../errors.ts";
import { ActiveSimulationNotFoundError } from "../errors.ts";
import {
  computeLoanMetrics,
  buildAdherenceMetrics,
} from "./dashboardCalculationsService.ts";
import { buildMonthlyProjectionSeries } from "./simulationProjectionService";
import type { DashboardIncludeOptions } from "../validation/dashboard.ts";

const CACHE_TTL_MS = 300_000; // 5 minutes

interface CacheEntry {
  dto: DashboardOverviewDto;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const makeCacheKey = (
  userId: string,
  include: DashboardIncludeOptions,
): string => {
  const flags: string[] = [];

  if (include.monthlyTrend) {
    flags.push("monthlyTrend");
  }

  if (include.interestBreakdown) {
    flags.push("interestBreakdown");
  }

  if (include.adherence) {
    flags.push("adherence");
  }

  return `${userId}|${flags.join(",")}`;
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
      "User identifier is required",
    );
  }

  return userId;
};

const fetchActiveSimulation = async (
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ActiveSimulationSummary | null> => {
  const { data, error } = await supabase
    .from("simulations")
    .select(
      "id, strategy, goal, projected_payoff_month, total_interest_saved, status, stale",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw internalError("DB_ERROR", "Failed to fetch active simulation", {
      cause: error,
    });
  }

  return {
    id: data.id,
    strategy: data.strategy,
    goal: data.goal,
    projectedPayoffMonth: data.projected_payoff_month,
    totalInterestSaved: data.total_interest_saved || 0,
    status: data.status,
    stale: data.stale ?? false,
  };
};

const fetchLoans = async (
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Database["public"]["Tables"]["loans"]["Row"][]> => {
  const { data, error } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw internalError("DB_ERROR", "Failed to fetch loans", { cause: error });
  }

  return data || [];
};

const fetchCurrentMonthSchedule = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<DashboardOverviewCurrentMonth | null> => {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from("monthly_execution_logs")
    .select(
      `
      loan_id,
      interest_portion,
      principal_portion,
      scheduled_overpayment_amount,
      payment_status,
      overpayment_status,
      month_start
    `,
    )
    .eq("user_id", userId)
    .eq("month_start", currentMonthStart.toISOString().split("T")[0])
    .in(
      "loan_id",
      await supabase
        .from("loans")
        .select("id")
        .eq("user_id", userId)
        .then(({ data }) => data?.map((l) => l.id) || []),
    );

  if (error) {
    throw internalError("DB_ERROR", "Failed to fetch current month schedule", {
      cause: error,
    });
  }

  if (!data || data.length === 0) {
    return {
      monthStart: currentMonthStart.toISOString().split("T")[0],
      entries: [],
    };
  }

  return {
    monthStart: data[0].month_start,
    entries: data.map((entry) => ({
      loanId: entry.loan_id,
      scheduledPayment:
        (entry.interest_portion || 0) + (entry.principal_portion || 0),
      scheduledOverpayment: entry.scheduled_overpayment_amount,
      paymentStatus: entry.payment_status,
      overpaymentStatus: entry.overpayment_status,
    })),
  };
};

const fetchAdherence = async (
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DashboardOverviewAdherence> => {
  const { data, error } = await supabase
    .from("adherence_metrics")
    .select(
      "backfilled_payment_count, overpayment_executed_count, overpayment_skipped_count, paid_payment_count",
    )
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return buildAdherenceMetrics(0, 0, 0, 0);
    }
    throw internalError("DB_ERROR", "Failed to fetch adherence metrics", {
      cause: error,
    });
  }

  return buildAdherenceMetrics(
    data.backfilled_payment_count || 0,
    data.overpayment_executed_count || 0,
    data.overpayment_skipped_count || 0,
    data.paid_payment_count || 0,
  );
};

export const getDashboardOverview = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  include: DashboardIncludeOptions,
  options?: { now?: Date },
): Promise<DashboardOverviewDto> => {
  const validatedUserId = assertUserId(userId);
  const validatedSupabase = assertSupabaseClient(supabase);

  const cacheKey = makeCacheKey(validatedUserId, include);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.dto;
  }

  const activeSimulation = await fetchActiveSimulation(
    validatedSupabase,
    validatedUserId,
  );
  if (!activeSimulation) {
    throw new ActiveSimulationNotFoundError();
  }

  const loans = await fetchLoans(validatedSupabase, validatedUserId);
  const loanMetrics = loans.map((loan) => computeLoanMetrics(loan));

  const currentMonth = await fetchCurrentMonthSchedule(
    validatedSupabase,
    validatedUserId,
    options?.now,
  );

  let graphs: DashboardOverviewGraphData | undefined;
  if (include.monthlyTrend || include.interestBreakdown) {
    const projectionSeries = await buildMonthlyProjectionSeries(
      validatedSupabase,
      validatedUserId,
      activeSimulation,
      { now: options?.now },
    );
    graphs = {
      ...graphs,
      ...(include.monthlyTrend
        ? { monthlyBalances: projectionSeries.monthlyBalances }
        : {}),
      ...(include.interestBreakdown
        ? { interestVsSaved: projectionSeries.interestVsSaved }
        : {}),
    };
  }

  const adherence = include.adherence
    ? await fetchAdherence(validatedSupabase, validatedUserId)
    : undefined;

  const dto: DashboardOverviewDto = {
    activeSimulation,
    loans: loanMetrics,
    currentMonth,
    ...(graphs ? { graphs } : {}),
    ...(adherence ? { adherence } : {}),
  } satisfies DashboardOverviewDto;

  cache.set(cacheKey, { dto, expiresAt: Date.now() + CACHE_TTL_MS });

  return dto;
};

export const invalidateDashboardCache = (userId: string): void => {
  // Invalidate all cache entries for this user
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}|`)) {
      cache.delete(key);
    }
  }
};
