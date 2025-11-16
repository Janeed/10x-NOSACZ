import { Button } from "@/components/ui/button";
import type { ApiErrorShape } from "@/lib/viewModels/loans";
import type { SettingsSummaryVM } from "@/lib/viewModels/wizardSimulation";
import { formatCurrency } from "@/lib/formatters";

interface SettingsSummaryProps {
  readonly settings: SettingsSummaryVM | null;
  readonly isLoading: boolean;
  readonly error?: ApiErrorShape | null;
  readonly onRetry?: () => void;
}

export function SettingsSummary({
  settings,
  isLoading,
  error,
  onRetry,
}: SettingsSummaryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="h-14 animate-pulse rounded-md bg-muted/40" />
        <div className="h-14 animate-pulse rounded-md bg-muted/40" />
        <p className="text-xs text-muted-foreground">Loading settings…</p>
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
          Unable to load settings.
        </p>
        <p className="text-xs text-destructive-foreground/80">
          {error.message ?? "Please try again later."}
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

  if (!settings) {
    return (
      <p className="text-xs text-muted-foreground">
        Settings will appear here once the API integration is available.
      </p>
    );
  }

  const noLimit = !settings.overpaymentLimit || settings.overpaymentLimit <= 0;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <dl className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Monthly overpayment limit</dt>
          <dd className="font-medium text-foreground">
            {formatCurrency(settings.overpaymentLimit ?? 0)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Reinvest reduced payments</dt>
          <dd className="font-medium text-foreground">
            {settings.reinvestReducedPayments ? "Enabled" : "Disabled"}
          </dd>
        </div>
      </dl>

      {noLimit ? (
        <p className="text-xs text-amber-600">
          Tip: Set a monthly overpayment limit to maximise strategy
          effectiveness. You can adjust this anytime in settings.
        </p>
      ) : null}

      <Button asChild size="sm" variant="outline">
        <a href="/settings" className="w-full justify-center">
          Open settings
        </a>
      </Button>
    </div>
  );
}
