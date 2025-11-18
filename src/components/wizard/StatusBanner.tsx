import type { ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SimulationStatusVM } from "@/lib/viewModels/wizardSimulation";

interface StatusBannerProps {
  readonly status: SimulationStatusVM;
  readonly submitting?: boolean;
  readonly onRetry?: () => void;
  readonly onCancelAndRetry?: () => void;
}

const variantStyles: Record<SimulationStatusVM["phase"], string> = {
  idle: "border-border bg-muted/10 text-muted-foreground",
  queued: "border-primary/40 bg-primary/10 text-primary",
  running: "border-primary/50 bg-primary/10 text-primary",
  completed: "border-emerald-400/40 bg-emerald-400/10 text-emerald-700",
  cancelled: "border-border/50 bg-muted/10 text-muted-foreground",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  conflict: "border-amber-400/50 bg-amber-400/10 text-amber-800",
};

const iconForPhase: Record<
  SimulationStatusVM["phase"],
  ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  idle: Info,
  queued: Loader2,
  running: Loader2,
  completed: CheckCircle2,
  cancelled: XCircle,
  error: AlertTriangle,
  conflict: AlertTriangle,
};

const defaultMessage = (status: SimulationStatusVM) => {
  return (
    status.message ??
    {
      idle: "No simulation in progress. Configure your inputs and start a new run when ready.",
      queued: "Simulation queued. We will update the status automatically.",
      running:
        "Simulation is running. You can stay on this page while we crunch the numbers.",
      completed:
        "Simulation completed. Review your dashboard for the updated projections.",
      cancelled: "Simulation cancelled. Adjust your inputs and try again.",
      error:
        "The simulation encountered an error. Retry the submission when you are ready.",
      conflict:
        "Another simulation is already running. Cancel it or retry once it finishes.",
    }[status.phase]
  );
};

const actionLabelForPhase = (phase: SimulationStatusVM["phase"]): string => {
  switch (phase) {
    case "error":
      return "Retry";
    case "conflict":
      return "Retry submission";
    default:
      return "";
  }
};

export function StatusBanner({
  status,
  submitting = false,
  onRetry,
  onCancelAndRetry,
}: StatusBannerProps) {
  const Icon = iconForPhase[status.phase];
  const isLoaderPhase = status.phase === "queued" || status.phase === "running";
  const spinner = isLoaderPhase;
  const isSubmittingPending = submitting && status.phase === "idle";

  const showAction = (() => {
    if (status.phase === "conflict") {
      return Boolean(onCancelAndRetry ?? onRetry);
    }
    if (status.phase === "error") {
      return Boolean(onRetry);
    }
    return false;
  })();

  const actionHandler =
    status.phase === "conflict" ? (onCancelAndRetry ?? onRetry) : onRetry;
  const actionLabel = actionLabelForPhase(status.phase);

  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col gap-3 rounded-lg border px-4 py-3",
        variantStyles[status.phase],
      )}
    >
      <div className="flex items-start justify-center gap-3">
        <Icon
          aria-hidden
          className={cn("mt-0.5 size-5", spinner ? "animate-spin" : undefined)}
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-none text-current">
            {isSubmittingPending
              ? "Submitting request"
              : status.phase === "idle"
                ? "Ready to run a simulation"
                : status.phase === "queued"
                  ? "Simulation queued"
                  : status.phase === "running"
                    ? "Simulation in progress"
                    : status.phase === "completed"
                      ? "Simulation completed"
                      : status.phase === "cancelled"
                        ? "Simulation cancelled"
                        : status.phase === "conflict"
                          ? "Simulation conflict"
                          : "Simulation error"}
          </p>
          <p className="text-sm">{defaultMessage(status)}</p>
          {status.simulationId ? (
            <p className="text-xs text-muted-foreground">
              Simulation ID:{" "}
              <span className="font-mono">{status.simulationId}</span>
            </p>
          ) : null}
          {status.completedAt ? (
            <a
              href="/dashboard"
              className="inline-flex items-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*='size-'])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-8 rounded-md gap-1.5 px-3 has-[&gt;svg]:px-2.5 w-full justify-center"
            >
              Review Dashboard
            </a>
          ) : null}
        </div>
      </div>
      {showAction && actionHandler ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={actionHandler}
          >
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
