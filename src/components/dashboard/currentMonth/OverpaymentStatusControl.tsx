import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OverpaymentStatusControlProps {
  readonly status: string;
  readonly canExecute: boolean;
  readonly scheduledAmount: number;
  readonly disabled?: boolean;
  readonly onExecute: () => void;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  executed: {
    label: "Executed",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  skipped: {
    label: "Skipped",
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
};

const normalizeStatus = (value: string) => value?.toLowerCase?.() ?? "unknown";

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2,
});

export function OverpaymentStatusControl({
  status,
  canExecute,
  scheduledAmount,
  disabled,
  onExecute,
}: OverpaymentStatusControlProps) {
  const descriptor = STATUS_STYLES[normalizeStatus(status)] ?? {
    label: status || "Unknown",
    className: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            descriptor.className,
          )}
        >
          {descriptor.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {currencyFormatter.format(scheduledAmount)} scheduled
        </span>
      </div>
      {canExecute ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onExecute}
          disabled={disabled}
        >
          Execute overpayment
        </Button>
      ) : null}
    </div>
  );
}
