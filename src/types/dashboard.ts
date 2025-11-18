import type { ReactNode } from "react";
import type {
  ActiveSimulationSummary,
  DashboardOverviewAdherence,
  DashboardOverviewCurrentMonth,
  DashboardOverviewDto,
  DashboardOverviewGraphInterestPoint,
  DashboardOverviewGraphMonthlyBalancePoint,
  MonthlyExecutionLogDto,
  OverpaymentStatus,
  PaymentStatus,
} from "@/types";

export interface DashboardContextValue {
  readonly overview: DashboardOverviewDto | undefined;
  readonly activeSimulation: ActiveSimulationSummary | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly refetch: () => Promise<void>;
}

export interface OverviewCardVM {
  readonly title: string;
  readonly value: string | number | ReactNode;
  readonly tooltip?: string;
  readonly status?: "loading" | "ok";
}

export interface DashboardLoanVM {
  readonly loanId: string;
  readonly remainingBalance: number;
  readonly monthlyPayment: number;
  readonly interestSavedToDate: number;
  readonly monthsRemaining: number;
  readonly progressPercent: number;
  readonly isClosed: boolean;
}

export interface CurrentMonthEntryVM {
  readonly logId: string;
  readonly loanId: string;
  readonly loanInitialAmount: number;
  readonly scheduledPayment: number;
  readonly scheduledOverpayment: number;
  readonly paymentStatus: PaymentStatus;
  readonly overpaymentStatus: OverpaymentStatus;
  readonly isClosed: boolean;
  readonly canMarkPaid: boolean;
  readonly canExecuteOverpayment: boolean;
  readonly canSkip: boolean;
}

export interface MutationResult {
  readonly previous: CurrentMonthEntryVM;
  readonly updated: CurrentMonthEntryVM;
  readonly requestId?: string;
}

export type ChartBalancePointVM = DashboardOverviewGraphMonthlyBalancePoint;
export type ChartInterestPointVM = DashboardOverviewGraphInterestPoint;

export interface DashboardDataSource {
  readonly overview: DashboardOverviewDto | undefined;
  readonly activeSimulation: ActiveSimulationSummary | null;
  readonly executionLogs?: MonthlyExecutionLogDto[];
  readonly currentMonth: DashboardOverviewCurrentMonth | null;
  readonly adherence?: DashboardOverviewAdherence;
  readonly graphs?: {
    readonly balances?: DashboardOverviewGraphMonthlyBalancePoint[];
    readonly interest?: DashboardOverviewGraphInterestPoint[];
  };
  readonly refetch: () => Promise<void>;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly lastUpdatedAt: number | null;
}
