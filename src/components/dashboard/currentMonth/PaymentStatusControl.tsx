import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaymentStatusControlProps {
  readonly status: string;
  readonly canMarkPaid: boolean;
  readonly disabled?: boolean;
  readonly onMarkPaid: () => void;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  paid: {
    label: "Paid",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  backfilled: {
    label: "Backfilled",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
};

const normalizeStatus = (value: string) => value?.toLowerCase?.() ?? "unknown";

export function PaymentStatusControl({
  status,
  canMarkPaid,
  disabled,
  onMarkPaid,
}: PaymentStatusControlProps) {
  const descriptor = STATUS_STYLES[normalizeStatus(status)] ?? {
    label: status || "Unknown",
    className: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          descriptor.className,
        )}
      >
        {descriptor.label}
      </span>
      {canMarkPaid ? (
        <Button
          type="button"
          size="sm"
          onClick={onMarkPaid}
          disabled={disabled}
        >
          Mark paid
        </Button>
      ) : null}
    </div>
  );
}
