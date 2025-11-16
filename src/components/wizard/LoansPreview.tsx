import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { ApiErrorShape } from "@/lib/viewModels/loans";
import type { LoanPreviewVM } from "@/lib/viewModels/wizardSimulation";

interface LoansPreviewProps {
  readonly loans: LoanPreviewVM[];
  readonly isLoading: boolean;
  readonly error?: ApiErrorShape | null;
  readonly onRetry?: () => void;
}

const highlightLabel = (highlight: LoanPreviewVM["highlight"]) => {
  switch (highlight) {
    case "highRate":
      return "High rate";
    case "smallBalance":
      return "Small balance";
    default:
      return null;
  }
};

const formatRate = (rate: number | null | undefined): string => {
  if (typeof rate !== "number" || Number.isNaN(rate)) {
    return "n/a";
  }

  return new Intl.NumberFormat("pl-PL", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(rate);
};

export function LoansPreview({
  loans,
  isLoading,
  error,
  onRetry,
}: LoansPreviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="h-12 animate-pulse rounded-md bg-muted/40" />
        <div className="h-12 animate-pulse rounded-md bg-muted/40" />
        <p className="text-xs text-muted-foreground">Loading loans…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-4"
        role="alert"
      >
        <p className="text-sm font-semibold text-destructive-foreground">
          Unable to load loans.
        </p>
        <p className="text-xs text-destructive-foreground/80">
          {error.message ?? "Try refreshing the list."}
        </p>
        {onRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="border-destructive text-destructive"
          >
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-xs text-muted-foreground">
          You do not have any open loans yet. Add a loan to unlock simulation
          strategies.
        </p>
        <Button asChild size="sm" variant="outline">
          <a href="/loans/new" className="w-full justify-center">
            Add a loan
          </a>
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {loans.slice(0, 5).map((loan) => {
        const label = highlightLabel(loan.highlight);
        return (
          <li
            key={loan.id}
            className="rounded-md border border-border/70 bg-card/40 p-3"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{loan.id}</span>
              {label ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  {label}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-lg font-semibold text-foreground">
                {formatCurrency(loan.remainingBalance ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground">
                Rate {formatRate(loan.annualRate)} · {loan.remainingTermMonths}{" "}
                months left
              </span>
            </div>
          </li>
        );
      })}
      {loans.length > 5 ? (
        <li className="text-xs text-muted-foreground">
          Additional loans hidden for brevity.
        </li>
      ) : null}
    </ul>
  );
}
