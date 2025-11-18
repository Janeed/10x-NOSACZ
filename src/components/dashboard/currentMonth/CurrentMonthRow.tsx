import { LoanStatusBadge } from "../loans/LoanStatusBadge";
import { PaymentStatusControl } from "./PaymentStatusControl";
import { OverpaymentStatusControl } from "./OverpaymentStatusControl";
import { SkipActionControl } from "./SkipActionControl";
import type { CurrentMonthEntryVM } from "@/types/dashboard";

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2,
});

interface CurrentMonthEntryHandlers {
  readonly onMarkPaid: () => void;
  readonly onExecuteOverpayment: () => void;
  readonly onSkip: () => void;
  readonly disabled?: boolean;
}

interface CurrentMonthRowProps extends CurrentMonthEntryHandlers {
  readonly entry: CurrentMonthEntryVM;
}

export function CurrentMonthRow({
  entry,
  onMarkPaid,
  onExecuteOverpayment,
  onSkip,
  disabled,
}: CurrentMonthRowProps) {
  return (
    <tr key={entry.logId} className="border-b border-border last:border-0">
      <td className="px-4 py-4 align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            Loan ({currencyFormatter.format(entry.loanInitialAmount)} left)
          </span>
          <LoanStatusBadge isClosed={entry.isClosed} />
        </div>
      </td>
      <td className="px-4 py-4 align-top text-sm text-foreground">
        {currencyFormatter.format(entry.scheduledPayment)}
      </td>
      <td className="px-4 py-4 align-top text-sm text-foreground">
        {currencyFormatter.format(entry.scheduledOverpayment ?? 0)}
      </td>
      <td className="px-4 py-4 align-top">
        <PaymentStatusControl
          status={entry.paymentStatus}
          canMarkPaid={entry.canMarkPaid}
          onMarkPaid={onMarkPaid}
          disabled={disabled}
        />
      </td>
      <td className="px-4 py-4 align-top">
        <OverpaymentStatusControl
          status={entry.overpaymentStatus}
          canExecute={entry.canExecuteOverpayment}
          scheduledAmount={entry.scheduledOverpayment ?? 0}
          onExecute={onExecuteOverpayment}
          disabled={disabled}
        />
      </td>
      <td className="px-4 py-4 align-top text-right">
        <SkipActionControl
          canSkip={entry.canSkip}
          onSkip={onSkip}
          disabled={disabled}
        />
      </td>
    </tr>
  );
}

export function CurrentMonthCard({
  entry,
  onMarkPaid,
  onExecuteOverpayment,
  onSkip,
  disabled,
}: CurrentMonthRowProps) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-medium text-foreground">
          Loan #{entry.loanId}
        </span>
        <LoanStatusBadge isClosed={entry.isClosed} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Scheduled payment</dt>
          <dd className="font-medium text-foreground">
            {currencyFormatter.format(entry.scheduledPayment)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Overpayment</dt>
          <dd className="font-medium text-foreground">
            {currencyFormatter.format(entry.scheduledOverpayment ?? 0)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payment
          </span>
          <PaymentStatusControl
            status={entry.paymentStatus}
            canMarkPaid={entry.canMarkPaid}
            onMarkPaid={onMarkPaid}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overpayment
          </span>
          <OverpaymentStatusControl
            status={entry.overpaymentStatus}
            canExecute={entry.canExecuteOverpayment}
            scheduledAmount={entry.scheduledOverpayment ?? 0}
            onExecute={onExecuteOverpayment}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Actions
          </span>
          <SkipActionControl
            canSkip={entry.canSkip}
            onSkip={onSkip}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
