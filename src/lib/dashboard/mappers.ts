import type {
  DashboardOverviewCurrentMonthEntry,
  DashboardOverviewDto,
  DashboardOverviewLoanItem,
  PaymentStatus,
  OverpaymentStatus,
} from "@/types";
import type { CurrentMonthEntryVM, DashboardLoanVM } from "@/types/dashboard";

const RUNNING_STATUSES = new Set<string>(["RUNNING", "QUEUED"]);
const COMPLETE_PAYMENT_STATUSES = new Set<string>(["PAID", "BACKFILLED"]);
const COMPLETED_OVERPAYMENT_STATUSES = new Set<string>(["EXECUTED", "SKIPPED"]);

const normalizeStatus = (value: string) => value.toUpperCase();

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const clamped = Math.min(Math.max(value, 0), 100);
  return Math.round(clamped * 100) / 100;
};

export const buildExecutionLogId = (
  monthStart: string | Date,
  loanId: string,
  logId?: string,
) => {
  if (logId) {
    return logId;
  }

  const monthKey =
    monthStart instanceof Date ? monthStart.toISOString() : monthStart;
  return `${loanId}:${monthKey}`;
};

export const mapLoanToViewModel = (
  loan: DashboardOverviewLoanItem,
): DashboardLoanVM => {
  const progressPercent = clampPercent(loan.progress * 100);

  return {
    loanId: loan.loanId,
    remainingBalance: loan.remainingBalance,
    monthlyPayment: loan.monthlyPayment,
    interestSavedToDate: loan.interestSavedToDate,
    monthsRemaining: loan.monthsRemaining,
    progressPercent,
    isClosed: loan.isClosed,
  } satisfies DashboardLoanVM;
};

interface CurrentMonthMappingContext {
  readonly overview: DashboardOverviewDto;
  readonly monthStart: string;
  readonly isSimulationRunning: boolean;
  readonly isSimulationStale: boolean;
  readonly loanLookup: Map<string, DashboardOverviewLoanItem>;
}

export const mapCurrentMonthEntryToViewModel = (
  entry: DashboardOverviewCurrentMonthEntry,
  context: CurrentMonthMappingContext,
): CurrentMonthEntryVM => {
  const logId = buildExecutionLogId(
    context.monthStart,
    entry.loanId,
    entry.logId,
  );
  const loan = context.loanLookup.get(entry.loanId);
  const paymentStatus = entry.paymentStatus as PaymentStatus;
  const overpaymentStatus = entry.overpaymentStatus as OverpaymentStatus;
  const isClosed = loan?.isClosed ?? false;
  const scheduledOverpayment = entry.scheduledOverpayment ?? 0;
  const normalizedPaymentStatus = normalizeStatus(String(paymentStatus));
  const normalizedOverpaymentStatus = normalizeStatus(
    String(overpaymentStatus),
  );

  const canMarkPaid =
    !context.isSimulationRunning &&
    !isClosed &&
    !COMPLETE_PAYMENT_STATUSES.has(normalizedPaymentStatus);

  const canExecuteOverpayment =
    !context.isSimulationRunning &&
    !context.isSimulationStale &&
    !isClosed &&
    normalizedOverpaymentStatus === "PENDING";

  const canSkip =
    !context.isSimulationRunning &&
    !isClosed &&
    normalizedOverpaymentStatus === "PENDING";

  return {
    logId,
    loanId: entry.loanId,
    loanInitialAmount: loan?.remainingBalance ?? 0,
    scheduledPayment: entry.scheduledPayment,
    scheduledOverpayment,
    paymentStatus,
    overpaymentStatus,
    isClosed,
    canMarkPaid,
    canExecuteOverpayment,
    canSkip,
  } satisfies CurrentMonthEntryVM;
};

export const createLoanLookup = (overview: DashboardOverviewDto) => {
  return new Map(overview.loans.map((loan) => [loan.loanId, loan] as const));
};

export const isSimulationRunning = (status: string | undefined | null) => {
  if (!status) {
    return false;
  }
  return RUNNING_STATUSES.has(normalizeStatus(String(status)));
};

export const isOverpaymentFinalised = (status: OverpaymentStatus | string) => {
  return COMPLETED_OVERPAYMENT_STATUSES.has(normalizeStatus(String(status)));
};
