import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "./db/database.types";

// Shared primitives derived from database schema to keep API models aligned with storage.
type UserId = Tables<"user_settings">["user_id"];
type LoanRow = Tables<"loans">;
type LoanInsert = TablesInsert<"loans">;
type LoanUpdate = TablesUpdate<"loans">;
type LoanChangeEventRow = Tables<"loan_change_events">;
type LoanChangeEventInsert = TablesInsert<"loan_change_events">;
type SimulationRow = Tables<"simulations">;
type SimulationInsert = TablesInsert<"simulations">;
type SimulationLoanSnapshotRow = Tables<"simulation_loan_snapshots">;
type SimulationHistoryMetricRow = Tables<"simulation_history_metrics">;
type SimulationHistoryMetricInsert = TablesInsert<"simulation_history_metrics">;
type MonthlyExecutionLogRow = Tables<"monthly_execution_logs">;
type MonthlyExecutionLogInsert = TablesInsert<"monthly_execution_logs">;
type MonthlyExecutionLogUpdate = TablesUpdate<"monthly_execution_logs">;
type AdherenceMetricRow = Tables<"adherence_metrics">;
type UserSettingsRow = Tables<"user_settings">;
type UserSettingsInsert = TablesInsert<"user_settings">;
type AdherenceMetricUpdate = TablesUpdate<"adherence_metrics">;

export type GoalType = Enums<"goal_type">;
export type LoanChangeType = Enums<"loan_change_type">;
export type OverpaymentStatus = Enums<"overpayment_status">;
export type PaymentStatus = Enums<"payment_status">;
export type SimulationStatus = Enums<"simulation_status">;

type Ordering = "asc" | "desc";

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type PaginatedResult<T> = PaginationMeta & {
  items: T[];
};

// Authentication models (Supabase Auth integration)
export interface AuthSignupRequest {
  email: string;
  password: string;
}

export interface AuthSignupResponse {
  user: { id: UserId; email: string };
  session: { accessToken: string; refreshToken: string };
}

export type AuthSigninRequest = AuthSignupRequest;
export type AuthSigninResponse = AuthSignupResponse;
export type AuthSignoutResponse = void;

export interface AuthResetPasswordRequest {
  email: string;
}

export interface AuthResetPasswordResponse {
  accepted: boolean;
}

// User Settings
export interface UserSettingsDto {
  userId: UserSettingsRow["user_id"];
  monthlyOverpaymentLimit: UserSettingsRow["monthly_overpayment_limit"];
  reinvestReducedPayments: UserSettingsRow["reinvest_reduced_payments"];
  updatedAt: UserSettingsRow["updated_at"];
}

export interface UpdateUserSettingsCommand {
  monthlyOverpaymentLimit: NonNullable<
    UserSettingsInsert["monthly_overpayment_limit"]
  >;
  reinvestReducedPayments: NonNullable<
    UserSettingsInsert["reinvest_reduced_payments"]
  >;
}

// Loans
export interface LoanDto {
  id: LoanRow["id"];
  userId: LoanRow["user_id"];
  principal: LoanRow["principal"];
  remainingBalance: LoanRow["remaining_balance"];
  annualRate: LoanRow["annual_rate"];
  termMonths: LoanRow["term_months"];
  originalTermMonths: LoanRow["original_term_months"];
  startMonth: LoanRow["start_month"];
  isClosed: LoanRow["is_closed"];
  closedMonth: LoanRow["closed_month"];
  createdAt: LoanRow["created_at"];
  staleSimulation?: boolean;
}

export interface LoanListQuery {
  page?: number;
  pageSize?: number;
  isClosed?: boolean;
  sort?: "created_at" | "start_month" | "remaining_balance";
  order?: Ordering;
}

export type LoanListResponse = PaginatedResult<LoanDto>;

export interface CreateLoanCommand {
  id?: LoanInsert["id"];
  principal: LoanInsert["principal"];
  remainingBalance: LoanInsert["remaining_balance"];
  annualRate: LoanInsert["annual_rate"];
  termMonths: LoanInsert["term_months"];
  originalTermMonths: LoanInsert["original_term_months"];
  startMonth: NonNullable<LoanInsert["start_month"]>;
}

export type UpdateLoanCommand = CreateLoanCommand & {
  isClosed?: LoanUpdate["is_closed"];
  closedMonth?: LoanUpdate["closed_month"];
};

export type PatchLoanCommand = Partial<UpdateLoanCommand>;

// Loan Change Events
export interface LoanChangeEventDto {
  id: LoanChangeEventRow["id"];
  loanId: LoanChangeEventRow["loan_id"];
  changeType: LoanChangeEventRow["change_type"];
  createdAt: LoanChangeEventRow["created_at"];
  effectiveMonth: LoanChangeEventRow["effective_month"];
  oldAnnualRate: LoanChangeEventRow["old_annual_rate"];
  newAnnualRate: LoanChangeEventRow["new_annual_rate"];
  oldPrincipal: LoanChangeEventRow["old_principal"];
  newPrincipal: LoanChangeEventRow["new_principal"];
  oldRemainingBalance: LoanChangeEventRow["old_remaining_balance"];
  newRemainingBalance: LoanChangeEventRow["new_remaining_balance"];
  oldTermMonths: LoanChangeEventRow["old_term_months"];
  newTermMonths: LoanChangeEventRow["new_term_months"];
  notes: LoanChangeEventRow["notes"];
}

export interface LoanChangeEventListQuery {
  loanId: LoanChangeEventRow["loan_id"];
  page?: number;
  pageSize?: number;
  effectiveMonthFrom?: LoanChangeEventRow["effective_month"];
  effectiveMonthTo?: LoanChangeEventRow["effective_month"];
  changeType?: LoanChangeType;
}

export type LoanChangeEventListResponse = PaginatedResult<LoanChangeEventDto>;

export interface CreateLoanChangeEventCommand {
  loanId: LoanChangeEventInsert["loan_id"];
  effectiveMonth: LoanChangeEventInsert["effective_month"];
  changeType: LoanChangeEventInsert["change_type"];
  notes?: LoanChangeEventInsert["notes"];
  oldAnnualRate?: LoanChangeEventInsert["old_annual_rate"];
  newAnnualRate?: LoanChangeEventInsert["new_annual_rate"];
  oldPrincipal?: LoanChangeEventInsert["old_principal"];
  newPrincipal?: LoanChangeEventInsert["new_principal"];
  oldRemainingBalance?: LoanChangeEventInsert["old_remaining_balance"];
  newRemainingBalance?: LoanChangeEventInsert["new_remaining_balance"];
  oldTermMonths?: LoanChangeEventInsert["old_term_months"];
  newTermMonths?: LoanChangeEventInsert["new_term_months"];
}

// Simulations
export interface SimulationDto {
  id: SimulationRow["id"];
  userId: SimulationRow["user_id"];
  strategy: SimulationRow["strategy"];
  goal: GoalType;
  status: SimulationRow["status"];
  isActive: SimulationRow["is_active"];
  stale: SimulationRow["stale"];
  monthlyOverpaymentLimit: SimulationRow["monthly_overpayment_limit"];
  paymentReductionTarget: SimulationRow["payment_reduction_target"];
  reinvestReducedPayments: SimulationRow["reinvest_reduced_payments"];
  baselineInterest: SimulationRow["baseline_interest"];
  totalInterestSaved: SimulationRow["total_interest_saved"];
  projectedMonthsToPayoff: SimulationRow["projected_months_to_payoff"];
  projectedPayoffMonth: SimulationRow["projected_payoff_month"];
  createdAt: SimulationRow["created_at"];
  startedAt: SimulationRow["started_at"];
  completedAt: SimulationRow["completed_at"];
  cancelledAt: SimulationRow["cancelled_at"];
  notes: SimulationRow["notes"];
}

export interface SimulationListQuery {
  status?: SimulationStatus;
  isActive?: boolean;
  stale?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "created_at" | "completed_at";
  order?: Ordering;
}

export type SimulationListResponse = PaginatedResult<SimulationDto>;

export interface SimulationQueuedResponse {
  simulationId: SimulationRow["id"];
  status: SimulationRow["status"];
  isActive: SimulationRow["is_active"];
  queuedAt: SimulationRow["created_at"];
}

export interface CreateSimulationCommand {
  strategy: SimulationInsert["strategy"];
  goal: GoalType;
  reinvestReducedPayments: NonNullable<
    SimulationInsert["reinvest_reduced_payments"]
  >;
  monthlyOverpaymentLimit?: SimulationInsert["monthly_overpayment_limit"];
  paymentReductionTarget?: SimulationInsert["payment_reduction_target"];
  notes?: SimulationInsert["notes"];
}

export interface SimulationLoanSnapshotDto {
  id: SimulationLoanSnapshotRow["id"];
  simulationId: SimulationLoanSnapshotRow["simulation_id"];
  loanId: SimulationLoanSnapshotRow["loan_id"];
  remainingTermMonths: SimulationLoanSnapshotRow["remaining_term_months"];
  startingBalance: SimulationLoanSnapshotRow["starting_balance"];
  startingMonth: SimulationLoanSnapshotRow["starting_month"];
  startingRate: SimulationLoanSnapshotRow["starting_rate"];
  userId: SimulationLoanSnapshotRow["user_id"];
}

export interface SimulationLoanSnapshotListQuery {
  simulationId: SimulationLoanSnapshotRow["simulation_id"];
  page?: number;
  pageSize?: number;
}

export type SimulationLoanSnapshotListResponse =
  PaginatedResult<SimulationLoanSnapshotDto>;

export interface SimulationHistoryMetricDto {
  id: SimulationHistoryMetricRow["id"];
  simulationId: SimulationHistoryMetricRow["simulation_id"];
  userId: SimulationHistoryMetricRow["user_id"];
  goal: GoalType;
  strategy: SimulationHistoryMetricRow["strategy"];
  capturedAt: SimulationHistoryMetricRow["captured_at"];
  baselineInterest: SimulationHistoryMetricRow["baseline_interest"];
  totalInterestSaved: SimulationHistoryMetricRow["total_interest_saved"];
  monthlyPaymentTotal: SimulationHistoryMetricRow["monthly_payment_total"];
  monthsToPayoff: SimulationHistoryMetricRow["months_to_payoff"];
  payoffMonth: SimulationHistoryMetricRow["payoff_month"];
  goalAlignment?: string;
}

export interface SimulationHistoryMetricListQuery {
  simulationId: SimulationHistoryMetricRow["simulation_id"];
  page?: number;
  pageSize?: number;
}

export type SimulationHistoryMetricListResponse =
  PaginatedResult<SimulationHistoryMetricDto>;

export interface CreateSimulationHistoryMetricCommand {
  simulationId: SimulationHistoryMetricInsert["simulation_id"];
  userId: SimulationHistoryMetricInsert["user_id"];
  goal: GoalType;
  strategy: SimulationHistoryMetricInsert["strategy"];
  capturedAt?: SimulationHistoryMetricInsert["captured_at"];
  baselineInterest?: SimulationHistoryMetricInsert["baseline_interest"];
  totalInterestSaved?: SimulationHistoryMetricInsert["total_interest_saved"];
  monthlyPaymentTotal?: SimulationHistoryMetricInsert["monthly_payment_total"];
  monthsToPayoff?: SimulationHistoryMetricInsert["months_to_payoff"];
  payoffMonth?: SimulationHistoryMetricInsert["payoff_month"];
}

export type SimulationDetailDto = SimulationDto & {
  loanSnapshots?: SimulationLoanSnapshotDto[];
  historyMetrics?: SimulationHistoryMetricDto[];
  monthlyPaymentTotal?: SimulationHistoryMetricRow["monthly_payment_total"];
  monthsToPayoff?: SimulationHistoryMetricRow["months_to_payoff"];
  payoffMonth?: SimulationHistoryMetricRow["payoff_month"];
};

export type SimulationActivationResponse = SimulationDetailDto;
export type SimulationCancelResponse = SimulationDetailDto;

export interface ActiveSimulationDashboardDto extends SimulationDetailDto {
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
}

// Monthly Execution Logs
export interface MonthlyExecutionLogDto {
  id: MonthlyExecutionLogRow["id"];
  loanId: MonthlyExecutionLogRow["loan_id"];
  userId: MonthlyExecutionLogRow["user_id"];
  monthStart: MonthlyExecutionLogRow["month_start"];
  paymentStatus: MonthlyExecutionLogRow["payment_status"];
  overpaymentStatus: MonthlyExecutionLogRow["overpayment_status"];
  scheduledOverpaymentAmount: MonthlyExecutionLogRow["scheduled_overpayment_amount"];
  actualOverpaymentAmount: MonthlyExecutionLogRow["actual_overpayment_amount"];
  interestPortion: MonthlyExecutionLogRow["interest_portion"];
  principalPortion: MonthlyExecutionLogRow["principal_portion"];
  remainingBalanceAfter: MonthlyExecutionLogRow["remaining_balance_after"];
  paymentExecutedAt: MonthlyExecutionLogRow["payment_executed_at"];
  overpaymentExecutedAt: MonthlyExecutionLogRow["overpayment_executed_at"];
  reasonCode: MonthlyExecutionLogRow["reason_code"];
  createdAt: MonthlyExecutionLogRow["created_at"];
  staleSimulation?: boolean;
}

export interface MonthlyExecutionLogListQuery {
  loanId?: MonthlyExecutionLogRow["loan_id"];
  monthStart?: MonthlyExecutionLogRow["month_start"];
  paymentStatus?: PaymentStatus;
  overpaymentStatus?: OverpaymentStatus;
  page?: number;
  pageSize?: number;
  sort?: "month_start";
  order?: Ordering;
}

export type MonthlyExecutionLogListResponse =
  PaginatedResult<MonthlyExecutionLogDto>;

export interface CreateMonthlyExecutionLogCommand {
  loanId: MonthlyExecutionLogInsert["loan_id"];
  monthStart: MonthlyExecutionLogInsert["month_start"];
  paymentStatus: MonthlyExecutionLogInsert["payment_status"];
  overpaymentStatus: MonthlyExecutionLogInsert["overpayment_status"];
  scheduledOverpaymentAmount?: MonthlyExecutionLogInsert["scheduled_overpayment_amount"];
  actualOverpaymentAmount?: MonthlyExecutionLogInsert["actual_overpayment_amount"];
  interestPortion?: MonthlyExecutionLogInsert["interest_portion"];
  principalPortion?: MonthlyExecutionLogInsert["principal_portion"];
  remainingBalanceAfter?: MonthlyExecutionLogInsert["remaining_balance_after"];
  paymentExecutedAt?: MonthlyExecutionLogInsert["payment_executed_at"];
  overpaymentExecutedAt?: MonthlyExecutionLogInsert["overpayment_executed_at"];
  reasonCode?: MonthlyExecutionLogInsert["reason_code"];
}

export interface PatchMonthlyExecutionLogCommand {
  paymentStatus?: MonthlyExecutionLogUpdate["payment_status"];
  overpaymentStatus?: MonthlyExecutionLogUpdate["overpayment_status"];
  paymentExecutedAt?: MonthlyExecutionLogUpdate["payment_executed_at"];
  overpaymentExecutedAt?: MonthlyExecutionLogUpdate["overpayment_executed_at"];
  reasonCode?: MonthlyExecutionLogUpdate["reason_code"];
  actualOverpaymentAmount?: MonthlyExecutionLogUpdate["actual_overpayment_amount"];
  scheduledOverpaymentAmount?: MonthlyExecutionLogUpdate["scheduled_overpayment_amount"];
  remainingBalanceAfter?: MonthlyExecutionLogUpdate["remaining_balance_after"];
}

// Adherence Metrics
export interface AdherenceMetricDto {
  userId: AdherenceMetricRow["user_id"];
  backfilledPaymentCount: AdherenceMetricRow["backfilled_payment_count"];
  overpaymentExecutedCount: AdherenceMetricRow["overpayment_executed_count"];
  overpaymentSkippedCount: AdherenceMetricRow["overpayment_skipped_count"];
  paidPaymentCount: AdherenceMetricRow["paid_payment_count"];
  updatedAt: AdherenceMetricRow["updated_at"];
  ratio: number;
}

export interface UpdateAdherenceMetricsCommand {
  userId: AdherenceMetricUpdate["user_id"];
  backfilledPaymentCount: NonNullable<
    AdherenceMetricUpdate["backfilled_payment_count"]
  >;
  overpaymentExecutedCount: NonNullable<
    AdherenceMetricUpdate["overpayment_executed_count"]
  >;
  overpaymentSkippedCount: NonNullable<
    AdherenceMetricUpdate["overpayment_skipped_count"]
  >;
  paidPaymentCount: NonNullable<AdherenceMetricUpdate["paid_payment_count"]>;
}

// Strategies
export interface StrategyDto {
  id: SimulationRow["strategy"];
  name: string;
  description: string;
}

// Dashboard Overview
export type ActiveSimulationSummary = Pick<
  SimulationDto,
  | "id"
  | "strategy"
  | "goal"
  | "projectedPayoffMonth"
  | "totalInterestSaved"
  | "status"
> & {
  projectedPayoffMonth: SimulationRow["projected_payoff_month"];
  totalInterestSaved: SimulationRow["total_interest_saved"];
};

export interface DashboardOverviewLoanItem {
  loanId: LoanRow["id"];
  remainingBalance: LoanRow["remaining_balance"];
  monthlyPayment: number;
  interestSavedToDate: number;
  monthsRemaining: number;
  progress: number;
  isClosed: LoanRow["is_closed"];
}

export interface DashboardOverviewCurrentMonthEntry {
  loanId: MonthlyExecutionLogRow["loan_id"];
  scheduledPayment: number;
  scheduledOverpayment: MonthlyExecutionLogRow["scheduled_overpayment_amount"];
  paymentStatus: MonthlyExecutionLogRow["payment_status"];
  overpaymentStatus: MonthlyExecutionLogRow["overpayment_status"];
}

export interface DashboardOverviewCurrentMonth {
  monthStart: MonthlyExecutionLogRow["month_start"];
  entries: DashboardOverviewCurrentMonthEntry[];
}

export interface DashboardOverviewGraphMonthlyBalancePoint {
  month: MonthlyExecutionLogRow["month_start"];
  totalRemaining: number;
}

export interface DashboardOverviewGraphInterestPoint {
  month: MonthlyExecutionLogRow["month_start"];
  interest: number;
  interestSaved: number;
}

export interface DashboardOverviewGraphData {
  monthlyBalances?: DashboardOverviewGraphMonthlyBalancePoint[];
  interestVsSaved?: DashboardOverviewGraphInterestPoint[];
}

export type DashboardOverviewAdherence = Pick<
  AdherenceMetricDto,
  | "backfilledPaymentCount"
  | "overpaymentExecutedCount"
  | "overpaymentSkippedCount"
  | "paidPaymentCount"
  | "ratio"
>;

export interface DashboardOverviewDto {
  activeSimulation: ActiveSimulationSummary | null;
  loans: DashboardOverviewLoanItem[];
  currentMonth: DashboardOverviewCurrentMonth | null;
  graphs?: DashboardOverviewGraphData;
  adherence?: DashboardOverviewAdherence;
}
