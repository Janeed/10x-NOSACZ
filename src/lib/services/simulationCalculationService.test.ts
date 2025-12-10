import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Database } from "../../db/database.types";
import * as sharedService from "./simulationSharedService.ts";
import {
  SimulationComputationContext,
  buildLoanSnapshots,
  computeSimulationMetrics,
} from "./simulationCalculationService.ts";

type SimulationRow = Database["public"]["Tables"]["simulations"]["Row"];
type LoanRow = Database["public"]["Tables"]["loans"]["Row"];

const BASE_SIMULATION: Partial<SimulationRow> = {
  id: "simulation-id",
  user_id: "user-id",
  strategy: "avalanche",
  status: "running",
  monthly_overpayment_limit: 0,
  reinvest_reduced_payments: false,
  created_at: "2025-01-01T00:00:00.000Z",
  started_at: "2025-01-01T00:00:00.000Z",
};

const createLoan = (startMonth?: string | null): LoanRow =>
  ({
    id: "loan-id",
    user_id: "user-id",
    annual_rate: 5,
    closed_month: null,
    created_at: "2025-01-01T00:00:00.000Z",
    is_closed: false,
    original_term_months: 24,
    principal: 1000,
    remaining_balance: 500,
    start_month:
      startMonth === undefined ? "2024-01-01" : (startMonth as string),
    term_months: 24,
  } as LoanRow);

const createSimulation = (
  overrides?: Partial<SimulationRow>,
): SimulationRow =>
  ({
    ...BASE_SIMULATION,
    ...overrides,
  } as SimulationRow);

const createContext = (
  loans: LoanRow[],
  simulation: SimulationRow,
): SimulationComputationContext => ({
  simulation,
  loans,
  userSettings: null,
});

describe("computeSimulationMetrics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zeroed metrics when no loans are available", () => {
    vi
      .spyOn(sharedService, "computeProjectedPayoffMonth")
      .mockReturnValue("2025-03-01");

    const context = createContext([], createSimulation());
    const result = computeSimulationMetrics(context);

    expect(result.baseline).toEqual({
      monthsToPayoff: 0,
      monthlyPaymentTotal: 0,
      totalInterest: 0,
      totalPrincipal: 0,
    });
    expect(result.strategy).toEqual({
      monthsToPayoff: 0,
      monthlyPaymentTotal: 0,
      totalInterestSaved: 0,
      projectedPayoffMonth: "2025-03-01",
      reductionFactor: 0,
    });
  });

  it("aggregates baseline and strategy metrics for active loans", () => {
    vi
      .spyOn(sharedService, "computeProjectedPayoffMonth")
      .mockReturnValue("2025-03-01");
    vi
      .spyOn(sharedService, "deriveStandardMonthlyPayment")
      .mockReturnValue(100);
    vi.spyOn(sharedService, "generateBaselineProjection").mockReturnValue([
      {
        month: "2025-01-01",
        interest: 10,
        principal: 20,
        remaining: 980,
        loanData: [],
      },
      {
        month: "2025-02-01",
        interest: 9,
        principal: 21,
        remaining: 960,
        loanData: [],
      },
    ]);
    vi.spyOn(sharedService, "generateStrategyProjection").mockReturnValue([
      {
        month: "2025-01-01",
        interest: 8,
        principal: 60,
        remaining: 840,
        loanData: [],
      },
    ]);

    const simulation = createSimulation({ monthly_overpayment_limit: 300 });
    const context = createContext([createLoan()], simulation);
    const result = computeSimulationMetrics(context);

    expect(result.baseline).toEqual({
      monthsToPayoff: 2,
      monthlyPaymentTotal: 100,
      totalInterest: 19,
      totalPrincipal: 500,
    });
    expect(result.strategy).toEqual({
      monthsToPayoff: 1,
      monthlyPaymentTotal: 400,
      totalInterestSaved: 11,
      projectedPayoffMonth: "2025-03-01",
      reductionFactor: 0.5,
    });
  });
});

describe("buildLoanSnapshots", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("respects the minimum term boundary and falls back to start month when missing", () => {
    vi
      .spyOn(sharedService, "computeProjectedPayoffMonth")
      .mockReturnValue("fallback-month");

    const simulation = createSimulation({ started_at: null, created_at: "2025-01-01T00:00:00.000Z" });
    const loanWithMissingStartMonth = createLoan(null as unknown as string);
    const context = createContext([loanWithMissingStartMonth], simulation);

    const snapshots = buildLoanSnapshots(context, {
      monthsToPayoff: 0,
      monthlyPaymentTotal: 0,
      totalInterestSaved: 0,
      projectedPayoffMonth: "",
      reductionFactor: 1,
    });

    expect(snapshots).toEqual([
      {
        loanId: "loan-id",
        simulationId: "simulation-id",
        userId: "user-id",
        remainingTermMonths: 1,
        startingBalance: 500,
        startingMonth: "fallback-month",
        startingRate: 5,
      },
    ]);
  });
});
