import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import type {
  DashboardOverviewGraphMonthlyBalancePoint,
  DashboardOverviewGraphInterestPoint,
  ActiveSimulationSummary,
} from "../../types.ts";
import { internalError } from "../errors.ts";
import {
  generateBaselineProjection,
  generateStrategyProjection,
} from "./simulationSharedService.ts";

type LoanRow = Database["public"]["Tables"]["loans"]["Row"];
type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];

type Supabase = SupabaseClient<Database>;

export interface ProjectionOptions {
  maxMonths?: number;
  now?: Date;
}

export interface MonthlyProjectionEntry {
  month: string;
  totalRemaining: number;
  interest: number;
  interestSaved: number;
}

const DEFAULT_MAX_MONTHS = 600; // 50 years

// generateMultiLoanBaseline is now replaced by shared generateBaselineProjection
// generateMultiLoanProjected is now replaced by shared generateStrategyProjection
// allocateOverpayment is now in shared service

const fetchLoans = async (
  supabase: Supabase,
  userId: string,
): Promise<LoanRow[]> => {
  const { data, error } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw internalError("DB_ERROR", "Failed to fetch loans", { cause: error });
  }

  return data || [];
};

const fetchUserSettings = async (
  supabase: Supabase,
  userId: string,
): Promise<UserSettingsRow | null> => {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw internalError("DB_ERROR", "Failed to fetch user settings", {
      cause: error,
    });
  }

  return data;
};

export const buildMonthlyProjectionSeries = async (
  supabase: Supabase,
  userId: string,
  simulation: ActiveSimulationSummary,
  options?: ProjectionOptions,
): Promise<{
  monthlyBalances: DashboardOverviewGraphMonthlyBalancePoint[];
  interestVsSaved: DashboardOverviewGraphInterestPoint[];
}> => {
  const now = options?.now || new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth();

  const loans = await fetchLoans(supabase, userId);
  const userSettings = await fetchUserSettings(supabase, userId);

  if (loans.length === 0) {
    return {
      monthlyBalances: [],
      interestVsSaved: [],
    };
  }

  // Generate baseline and projected for multi-loan
  const baselineSchedule = generateBaselineProjection(
    loans,
    startYear,
    startMonth,
    options?.maxMonths ?? DEFAULT_MAX_MONTHS,
  );
  const projectedSchedule = generateStrategyProjection(
    loans,
    simulation.strategy,
    simulation.paymentReductionTarget,
    userSettings?.monthly_overpayment_limit || 0,
    userSettings?.reinvest_reduced_payments || false,
    startYear,
    startMonth,
    options?.maxMonths ?? DEFAULT_MAX_MONTHS,
  );

  // Aggregate per month with per-loan data
  const monthlyData: Record<
    string,
    {
      totalRemaining: number;
      interest: number;
      baselineInterest: number;
      projectedLoans: Map<
        string,
        { loanAmount: number; remaining: number; interest: number }
      >;
      baselineLoans: Map<string, { interest: number }>;
    }
  > = {};

  // Process baseline
  for (const entry of baselineSchedule) {
    if (!monthlyData[entry.month]) {
      monthlyData[entry.month] = {
        totalRemaining: 0,
        interest: 0,
        baselineInterest: 0,
        projectedLoans: new Map(),
        baselineLoans: new Map(),
      };
    }
    monthlyData[entry.month].baselineInterest += entry.interest;

    // Store per-loan baseline data
    for (const loanEntry of entry.loanData) {
      monthlyData[entry.month].baselineLoans.set(loanEntry.loanId, {
        interest: loanEntry.interest,
      });
    }
  }

  // Process projected
  for (const entry of projectedSchedule) {
    if (!monthlyData[entry.month]) {
      monthlyData[entry.month] = {
        totalRemaining: 0,
        interest: 0,
        baselineInterest: 0,
        projectedLoans: new Map(),
        baselineLoans: new Map(),
      };
    }
    monthlyData[entry.month].totalRemaining += entry.remaining;
    monthlyData[entry.month].interest += entry.interest;

    // Store per-loan projected data
    for (const loanEntry of entry.loanData) {
      monthlyData[entry.month].projectedLoans.set(loanEntry.loanId, {
        loanAmount: loanEntry.loanAmount,
        remaining: loanEntry.remaining,
        interest: loanEntry.interest,
      });
    }
  }

  const months = Object.keys(monthlyData).sort();
  const monthlyBalances: DashboardOverviewGraphMonthlyBalancePoint[] = [];
  const interestVsSaved: DashboardOverviewGraphInterestPoint[] = [];

  for (const month of months) {
    const data = monthlyData[month];

    if (data.totalRemaining <= 0) {
      break;
    }

    // Build per-loan arrays for this month
    const loanBalances: {
      loanId: string;
      loanAmount: number;
      remaining: number;
    }[] = [];
    const loanInterests: {
      loanId: string;
      loanAmount: number;
      interest: number;
      interestSaved: number;
    }[] = [];

    data.projectedLoans.forEach((projectedData, loanId) => {
      loanBalances.push({
        loanId,
        loanAmount: projectedData.loanAmount,
        remaining: projectedData.remaining,
      });

      const baselineData = data.baselineLoans.get(loanId);
      const baselineInterest = baselineData?.interest || 0;

      loanInterests.push({
        loanId,
        loanAmount: projectedData.loanAmount,
        interest: projectedData.interest,
        interestSaved: Math.max(0, baselineInterest - projectedData.interest),
      });
    });

    monthlyBalances.push({
      month,
      totalRemaining: data.totalRemaining,
      loans: loanBalances,
    });
    interestVsSaved.push({
      month,
      interest: data.interest,
      interestSaved: Math.max(0, data.baselineInterest - data.interest),
      loans: loanInterests,
    });
  }

  return {
    monthlyBalances,
    interestVsSaved,
  };
};
