import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import type {
  DashboardOverviewGraphMonthlyBalancePoint,
  DashboardOverviewGraphInterestPoint,
  ActiveSimulationSummary,
} from "../../types.ts";
import { internalError } from "../errors.ts";

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

const isoMonthString = (year: number, monthIndex: number): string => {
  const month = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

const normalizeAnnualRate = (annualRate: number): number => {
  if (!Number.isFinite(annualRate) || annualRate <= 0) {
    return 0;
  }
  return annualRate > 1 ? annualRate / 100 : annualRate;
};

const deriveMonthlyPayment = (
  principal: number,
  annualRate: number,
  termMonths: number,
): number => {
  const monthlyRate = normalizeAnnualRate(annualRate) / 12;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  return (
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
  );
};

const generateMultiLoanBaseline = (
  loans: LoanRow[],
  startYear: number,
  startMonth: number,
): {
  month: string;
  interest: number;
  remaining: number;
  loanData: {
    loanId: string;
    loanAmount: number;
    interest: number;
    remaining: number;
  }[];
}[] => {
  const schedule: {
    month: string;
    interest: number;
    remaining: number;
    loanData: {
      loanId: string;
      loanAmount: number;
      interest: number;
      remaining: number;
    }[];
  }[] = [];
  let year = startYear;
  let month = startMonth;
  const balances = loans.map((loan) => loan.remaining_balance);
  let monthCount = 0;

  while (balances.some((b) => b > 0.01) && monthCount < DEFAULT_MAX_MONTHS) {
    const monthStr = isoMonthString(year, month);
    let totalInterest = 0;
    let totalRemaining = 0;
    const loanData: {
      loanId: string;
      interest: number;
      remaining: number;
      loanAmount: number;
    }[] = [];

    for (let i = 0; i < loans.length; i++) {
      if (balances[i] <= 0) continue;
      const loan = loans[i];
      const monthlyRate = normalizeAnnualRate(loan.annual_rate) / 12;
      const standardPayment = deriveMonthlyPayment(
        loan.remaining_balance,
        loan.annual_rate,
        loan.term_months,
      );
      const interest = balances[i] * monthlyRate;
      const principal = Math.min(standardPayment - interest, balances[i]);
      balances[i] -= principal;
      totalInterest += interest;
      totalRemaining += Math.max(0, balances[i]);

      loanData.push({
        loanId: loan.id,
        loanAmount: loan.principal,
        interest,
        remaining: Math.max(0, balances[i]),
      });
    }

    schedule.push({
      month: monthStr,
      interest: totalInterest,
      remaining: totalRemaining,
      loanData,
    });

    month++;
    if (month >= 12) {
      month = 0;
      year++;
    }
    monthCount++;
  }

  return schedule;
};

const generateMultiLoanProjected = (
  loans: LoanRow[],
  strategy: string,
  goal: string,
  monthlyOverpaymentLimit: number,
  reinvestReducedPayments: boolean,
  startYear: number,
  startMonth: number,
): {
  month: string;
  interest: number;
  remaining: number;
  loanData: {
    loanId: string;
    loanAmount: number;
    interest: number;
    remaining: number;
  }[];
}[] => {
  const schedule: {
    month: string;
    interest: number;
    remaining: number;
    loanData: {
      loanId: string;
      loanAmount: number;
      interest: number;
      remaining: number;
    }[];
  }[] = [];
  let year = startYear;
  let month = startMonth;
  const balances = loans.map((loan) => loan.remaining_balance);
  let monthCount = 0;

  // For fastest_payoff, continue until all loans are paid off
  // For payment_reduction, we still need to show the full amortization
  // The maxMonths cap prevents infinite loops
  while (balances.some((b) => b > 0.01) || monthCount < 1) {
    const monthStr = isoMonthString(year, month);
    let totalInterest = 0;
    let totalRemaining = 0;
    const loanData: {
      loanId: string;
      loanAmount: number;
      interest: number;
      remaining: number;
    }[] = [];

    // Allocate overpayment
    const overpaymentAllocation = allocateOverpayment(
      loans,
      strategy,
      monthlyOverpaymentLimit,
    );

    for (let i = 0; i < loans.length; i++) {
      if (balances[i] <= 0) continue;
      const loan = loans[i];
      const monthlyRate = normalizeAnnualRate(loan.annual_rate) / 12;
      const standardPayment = deriveMonthlyPayment(
        loan.remaining_balance,
        loan.annual_rate,
        loan.term_months,
      );
      const totalPayment = standardPayment + overpaymentAllocation[i];
      const interest = balances[i] * monthlyRate;
      const principal = Math.min(totalPayment - interest, balances[i]);
      balances[i] -= principal;
      totalInterest += interest;
      totalRemaining += Math.max(0, balances[i]);

      loanData.push({
        loanId: loan.id,
        loanAmount: loan.principal,
        interest,
        remaining: Math.max(0, balances[i]),
      });
    }

    schedule.push({
      month: monthStr,
      interest: totalInterest,
      remaining: totalRemaining,
      loanData,
    });

    month++;
    if (month >= 12) {
      month = 0;
      year++;
    }
    monthCount++;
  }

  return schedule;
};

const allocateOverpayment = (
  loans: LoanRow[],
  strategy: string,
  overpayment: number,
): number[] => {
  if (overpayment <= 0) return new Array(loans.length).fill(0);

  switch (strategy) {
    case "avalanche":
      // Sort by rate descending
      const sortedAvalanche = loans
        .map((loan, index) => ({ loan, index, rate: loan.annual_rate }))
        .sort((a, b) => b.rate - a.rate);
      const allocation = new Array(loans.length).fill(0);
      let remaining = overpayment;
      for (const item of sortedAvalanche) {
        if (remaining <= 0) break;
        allocation[item.index] = Math.min(
          remaining,
          overpayment / loans.length,
        ); // Simplified equal for now
        remaining -= allocation[item.index];
      }
      return allocation;

    case "snowball":
      // Sort by balance ascending
      const sortedSnowball = loans
        .map((loan, index) => ({
          loan,
          index,
          balance: loan.remaining_balance,
        }))
        .sort((a, b) => a.balance - b.balance);
      const allocationSnow = new Array(loans.length).fill(0);
      let remainingSnow = overpayment;
      for (const item of sortedSnowball) {
        if (remainingSnow <= 0) break;
        allocationSnow[item.index] = Math.min(
          remainingSnow,
          overpayment / loans.length,
        );
        remainingSnow -= allocationSnow[item.index];
      }
      return allocationSnow;

    case "equal":
    default:
      return new Array(loans.length).fill(overpayment / loans.length);

    case "ratio":
      // Proportional to interest
      const interests = loans.map(
        (loan) =>
          loan.remaining_balance * (normalizeAnnualRate(loan.annual_rate) / 12),
      );
      const totalInterest = interests.reduce((sum, i) => sum + i, 0);
      if (totalInterest === 0)
        return new Array(loans.length).fill(overpayment / loans.length);
      return interests.map((i) => (i / totalInterest) * overpayment);
  }
};

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
  const baselineSchedule = generateMultiLoanBaseline(
    loans,
    startYear,
    startMonth,
  );
  const projectedSchedule = generateMultiLoanProjected(
    loans,
    simulation.strategy,
    simulation.goal,
    userSettings?.monthly_overpayment_limit || 0,
    userSettings?.reinvest_reduced_payments || false,
    startYear,
    startMonth,
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
