import type { Database } from "../../db/database.types.ts";
import type {
  DashboardOverviewLoanItem,
  DashboardOverviewAdherence,
} from "../../types.ts";

/**
 * Service for dashboard-related calculations that are pure functions,
 * making them easily testable and reusable.
 */

/**
 * Calculates derived metrics for a loan based on its current state and simulation context.
 *
 * @param loan - The loan database row
 * @param activeSimulation - The active simulation summary (can be null)
 * @returns DashboardOverviewLoanItem with computed metrics
 */
export const computeLoanMetrics = (
  loan: Database["public"]["Tables"]["loans"]["Row"],
): DashboardOverviewLoanItem => {
  const remainingBalance = loan.remaining_balance;
  const annualRate = loan.annual_rate;
  const termMonths = loan.term_months;
  const originalTermMonths = loan.original_term_months;

  // Calculate monthly payment using amortization formula
  let monthlyPayment = 0;
  if (!loan.is_closed && remainingBalance > 0) {
    const monthlyRate = annualRate / 12;
    if (monthlyRate > 0) {
      monthlyPayment =
        (monthlyRate * remainingBalance) /
        (1 - Math.pow(1 + monthlyRate, -termMonths));
    }
  }

  // Calculate months remaining
  let monthsRemaining = 0;
  if (!loan.is_closed && remainingBalance > 0 && monthlyPayment > 0) {
    const monthlyRate = annualRate / 12;
    monthsRemaining = Math.ceil(
      -Math.log(1 - (remainingBalance * monthlyRate) / monthlyPayment) /
        Math.log(1 + monthlyRate),
    );
    monthsRemaining = Math.max(
      0,
      Math.min(
        monthsRemaining,
        originalTermMonths -
          (new Date().getFullYear() * 12 +
            new Date().getMonth() -
            new Date(loan.start_month).getFullYear() * 12 -
            new Date(loan.start_month).getMonth()),
      ),
    );
  }

  // Calculate progress
  const progress = loan.principal
    ? (loan.principal - remainingBalance) / loan.principal
    : 0;

  // Interest saved - MVP: 0
  const interestSavedToDate = 0;

  return {
    loanId: loan.id,
    remainingBalance,
    monthlyPayment,
    interestSavedToDate,
    monthsRemaining,
    progress: Math.min(1, Math.max(0, progress)),
    isClosed: loan.is_closed,
  };
};

/**
 * Calculates the adherence ratio from raw adherence metrics.
 *
 * @param executed - Number of overpayments executed
 * @param skipped - Number of overpayments skipped
 * @returns The ratio as a number between 0 and 1
 */
export const calculateAdherenceRatio = (
  executed: number,
  skipped: number,
): number => {
  return executed + skipped > 0 ? executed / (executed + skipped) : 0;
};

/**
 * Builds the adherence metrics object with calculated ratio.
 *
 * @param backfilledCount - Number of backfilled payments
 * @param executedCount - Number of overpayments executed
 * @param skippedCount - Number of overpayments skipped
 * @param paidCount - Number of payments paid
 * @returns DashboardOverviewAdherence object
 */
export const buildAdherenceMetrics = (
  backfilledCount: number,
  executedCount: number,
  skippedCount: number,
  paidCount: number,
): DashboardOverviewAdherence => {
  const ratio = calculateAdherenceRatio(executedCount, skippedCount);

  return {
    backfilledPaymentCount: backfilledCount,
    overpaymentExecutedCount: executedCount,
    overpaymentSkippedCount: skippedCount,
    paidPaymentCount: paidCount,
    ratio,
  };
};
