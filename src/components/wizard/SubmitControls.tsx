import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SimulationStatusVM } from "@/lib/viewModels/wizardSimulation";

interface SubmitControlsProps {
  readonly canSubmit: boolean;
  readonly submitting: boolean;
  readonly cancelling?: boolean;
  readonly status: SimulationStatusVM;
  readonly disableReason?: string | null;
  readonly onSubmit: () => void;
  readonly onCancel?: () => void;
  readonly onRetry?: () => void;
}

export function SubmitControls({
  canSubmit,
  submitting,
  cancelling = false,
  status,
  disableReason,
  onSubmit,
  onCancel,
  onRetry,
}: SubmitControlsProps) {
  const busyPhase = status.phase === "queued" || status.phase === "running";
  const showCancel = typeof onCancel === "function" && busyPhase;
  const showRetry =
    typeof onRetry === "function" && status.phase === "conflict";

  const primaryDisabled = !canSubmit || submitting || busyPhase;

  let primaryLabel = "Run simulation";
  if (submitting) {
    primaryLabel = "Submitting…";
  } else if (busyPhase) {
    primaryLabel = "Simulation in progress";
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onSubmit} disabled={primaryDisabled}>
          {submitting || busyPhase ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {primaryLabel}
        </Button>

        {showCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Cancel simulation
          </Button>
        ) : null}

        {showRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden />
            Retry submission
          </Button>
        ) : null}
      </div>

      {disableReason && primaryDisabled && !busyPhase && !submitting ? (
        <p className="text-xs text-muted-foreground">{disableReason}</p>
      ) : null}
    </div>
  );
}
