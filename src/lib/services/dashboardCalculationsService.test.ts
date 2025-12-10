import { describe, expect, expectTypeOf, it } from "vitest";
import type { Database } from "@/db/database.types";
import type {
  DashboardOverviewAdherence,
  DashboardOverviewLoanItem,
} from "@/types";

import {
  buildAdherenceMetrics,
  calculateAdherenceRatio,
  computeLoanMetrics,
} from "./dashboardCalculationsService";

const activeLoan: Database["public"]["Tables"]["loans"]["Row"] = {
  id: "loan-active",
  user_id: "user-1",
  created_at: "2022-01-01T00:00:00.000Z",
  start_month: "2022-01-01T00:00:00.000Z",
  is_closed: false,
  closed_month: null,
  annual_rate: 0.05,
  original_term_months: 240,
  term_months: 240,
  principal: 10000,
  remaining_balance: 10000,
};

const closedLoan: Database["public"]["Tables"]["loans"]["Row"] = {
  id: "loan-closed",
  user_id: "user-1",
  created_at: "2022-01-01T00:00:00.000Z",
  start_month: "2023-07-01T00:00:00.000Z",
  is_closed: true,
  closed_month: "2024-12-01T00:00:00.000Z",
  annual_rate: 0.08,
  original_term_months: 36,
  term_months: 36,
  principal: 1200,
  remaining_balance: 0,
};

describe("dashboardCalculationsService", () => {

  describe("computeLoanMetrics", () => {
    it("computes metrics for an active loan and caps monthsRemaining", () => {
      const now = new Date();
      const metrics = computeLoanMetrics(activeLoan);
      const startMonth = new Date(activeLoan.start_month);
      const monthsElapsed =
        now.getFullYear() * 12 +
        now.getMonth() -
        (startMonth.getFullYear() * 12 + startMonth.getMonth());
      const cap = activeLoan.original_term_months - monthsElapsed;

      expect(metrics.loanId).toBe(activeLoan.id);
      expect(metrics.monthlyPayment).toBeGreaterThan(0);
      expect(metrics.monthsRemaining).toEqual(cap);
      expect(metrics.progress).toBe(0);
      expect(metrics.interestSavedToDate).toBe(0);
      expect(metrics.isClosed).toBe(activeLoan.is_closed);
    });

    it("returns zeroed metrics for a closed loan", () => {
      const metrics = computeLoanMetrics(closedLoan);

      expect(metrics.monthlyPayment).toBe(0);
      expect(metrics.monthsRemaining).toBe(0);
      expect(metrics.progress).toBe(1);
      expect(metrics.isClosed).toBe(true);
    });

    it("returns the expected dashboard loan item shape", () => {
      expectTypeOf(computeLoanMetrics).returns.toEqualTypeOf<
        DashboardOverviewLoanItem
      >();
    });
  });

  describe("adherence helpers", () => {
    it("calculates zero ratio when no overpayment decisions exist", () => {
      expect(calculateAdherenceRatio(0, 0)).toBe(0);
    });

    it("computes a ratio based on executed vs skipped counts", () => {
      expect(calculateAdherenceRatio(3, 1)).toBeCloseTo(0.75);
    });

    it("builds a full adherence payload with the computed ratio", () => {
      const adherence = buildAdherenceMetrics(4, 9, 3, 16);

      expect(adherence).toEqual({
        backfilledPaymentCount: 4,
        overpaymentExecutedCount: 9,
        overpaymentSkippedCount: 3,
        paidPaymentCount: 16,
        ratio: 0.75,
      });

      expectTypeOf(adherence).toEqualTypeOf<DashboardOverviewAdherence>();
    });
  });
});
