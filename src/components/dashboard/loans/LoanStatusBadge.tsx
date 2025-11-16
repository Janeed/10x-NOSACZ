import { cn } from "@/lib/utils";

interface LoanStatusBadgeProps {
  readonly isClosed: boolean;
}

export function LoanStatusBadge({ isClosed }: LoanStatusBadgeProps) {
  const label = isClosed ? "Closed" : "Active";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        isClosed
          ? "bg-muted text-muted-foreground"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      )}
    >
      {label}
    </span>
  );
}
