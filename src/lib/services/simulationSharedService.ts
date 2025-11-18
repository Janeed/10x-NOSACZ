/**
 * Shared utilities for simulation calculation and projection services.
 * Contains common functions for loan math, date manipulation, and rate normalization.
 */

/**
 * Normalizes an annual interest rate to decimal form (0-1 range).
 * Handles both percentage (e.g., 5.5) and decimal (e.g., 0.055) inputs.
 *
 * @param annualRate - The annual interest rate (can be percentage or decimal)
 * @returns Normalized rate in decimal form (e.g., 0.055 for 5.5%)
 *
 * @example
 * normalizeAnnualRate(5.5)   // returns 0.055
 * normalizeAnnualRate(0.055) // returns 0.055
 * normalizeAnnualRate(0)     // returns 0
 * normalizeAnnualRate(-1)    // returns 0
 */
export const normalizeAnnualRate = (annualRate: number): number => {
  if (!Number.isFinite(annualRate) || annualRate <= 0) {
    return 0;
  }
  return annualRate > 1 ? annualRate / 100 : annualRate;
};

/**
 * Formats a year and month index into an ISO 8601 date string (YYYY-MM-01).
 * Always returns the first day of the month.
 *
 * @param year - The year (e.g., 2025)
 * @param monthIndex - Zero-based month index (0 = January, 11 = December)
 * @returns ISO date string in format "YYYY-MM-01"
 *
 * @example
 * isoMonthString(2025, 0)  // returns "2025-01-01"
 * isoMonthString(2025, 11) // returns "2025-12-01"
 */
export const isoMonthString = (year: number, monthIndex: number): string => {
  const month = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

/**
 * Converts a Date object to an ISO date string (YYYY-MM-DD).
 * Extracts only the date portion, discarding time.
 *
 * @param date - The date to convert
 * @returns ISO date string in format "YYYY-MM-DD"
 *
 * @example
 * dateToIsoString(new Date("2025-11-18T10:30:00Z")) // returns "2025-11-18"
 */
export const dateToIsoString = (date: Date): string =>
  date.toISOString().split("T")[0];

/**
 * Creates an ISO date string for a specific year and month (first day of month).
 * This is a convenience wrapper around isoMonthString for 1-based month inputs.
 *
 * @param year - The year (e.g., 2025)
 * @param month - One-based month (1 = January, 12 = December)
 * @returns ISO date string in format "YYYY-MM-01"
 *
 * @example
 * isoMonthStringByYearMonth(2025, 1)  // returns "2025-01-01"
 * isoMonthStringByYearMonth(2025, 12) // returns "2025-12-01"
 */
export const isoMonthStringByYearMonth = (
  year: number,
  month: number,
): string => {
  const date = new Date(year, month - 1, 1);
  return dateToIsoString(date);
};

/**
 * Calculates the standard monthly payment for an amortized loan using the PMT formula.
 * This is the standard formula used by banks for mortgages, auto loans, etc.
 *
 * Formula: PMT = (P × r) / (1 - (1 + r)^-n)
 * Where:
 * - P = principal (loan amount)
 * - r = monthly interest rate
 * - n = number of payment periods (months)
 *
 * For zero-interest loans, uses simple division: principal / term
 *
 * @param principal - The loan principal amount
 * @param annualRate - Annual interest rate (can be percentage or decimal)
 * @param termMonths - Number of months for loan term
 * @returns Monthly payment amount
 *
 * @example
 * // $200,000 loan at 5.5% for 30 years (360 months)
 * deriveStandardMonthlyPayment(200000, 5.5, 360) // returns ~1135.58
 *
 * // Zero interest loan
 * deriveStandardMonthlyPayment(10000, 0, 60) // returns 166.67
 */
export const deriveStandardMonthlyPayment = (
  principal: number,
  annualRate: number,
  termMonths: number,
): number => {
  const monthlyRate = normalizeAnnualRate(annualRate) / 12;

  // For zero-interest loans, use simple division
  if (monthlyRate === 0) {
    return principal / termMonths;
  }

  // Standard amortization formula (PMT)
  return (
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
  );
};

/**
 * Increments a year/month pair by one month, handling year rollover.
 *
 * @param year - Current year
 * @param monthIndex - Current zero-based month index (0-11)
 * @returns Object with incremented year and month
 *
 * @example
 * incrementMonth(2025, 10) // returns { year: 2025, month: 11 }
 * incrementMonth(2025, 11) // returns { year: 2026, month: 0 }
 */
export const incrementMonth = (
  year: number,
  monthIndex: number,
): { year: number; month: number } => {
  const newMonth = monthIndex + 1;
  if (newMonth >= 12) {
    return { year: year + 1, month: 0 };
  }
  return { year, month: newMonth };
};

/**
 * Computes a projected payoff date by adding months to a start date.
 *
 * @param startIso - ISO date string for start date (null uses current date)
 * @param monthsToPayoff - Number of months until payoff
 * @returns ISO date string for projected payoff month
 *
 * @example
 * computeProjectedPayoffMonth("2025-01-01", 36) // returns "2028-01-01"
 * computeProjectedPayoffMonth(null, 24)         // returns date 24 months from now
 */
export const computeProjectedPayoffMonth = (
  startIso: string | null,
  monthsToPayoff: number,
): string => {
  const reference = startIso ? new Date(startIso) : new Date();

  if (Number.isNaN(reference.getTime())) {
    return dateToIsoString(new Date());
  }

  const base = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const projected = new Date(
    base.getFullYear(),
    base.getMonth() + monthsToPayoff,
    1,
  );

  return dateToIsoString(projected);
};
