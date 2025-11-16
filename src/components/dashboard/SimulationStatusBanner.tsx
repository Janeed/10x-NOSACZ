import { useMemo, type ReactNode } from "react";
import { CircleAlert, Clock3, Loader2 } from "lucide-react";

import type { ActiveSimulationSummary, SimulationStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SimulationStatusBannerProps {
  readonly simulation: ActiveSimulationSummary | null;
  readonly onCancel?: () => void;
  readonly isCancelling?: boolean;
}

interface StatusDescriptor {
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly tone: "info" | "warning" | "neutral";
  readonly showCancel?: boolean;
}

const TONE_STYLES: Record<StatusDescriptor["tone"], string> = {
  info: "border-sky-400/40 bg-sky-400/10 text-sky-900 dark:text-sky-200",
  warning:
    "border-amber-400/40 bg-amber-400/10 text-amber-900 dark:text-amber-200",
  neutral: "border-muted/50 bg-muted/20 text-muted-foreground",
};

const CANCELABLE_STATUSES = new Set(["running", "queued"]);
const DISPLAYABLE_STATUSES = new Set(["running", "queued", "cancelled"]);

const buildDescriptor = (
  status: SimulationStatus | string | undefined,
): StatusDescriptor | null => {
  const normalized = (status ?? "").toString();
  switch (normalized) {
    case "running":
      return {
        title: "Simulation running",
        description:
          "We are crunching the numbers. Dashboard metrics will refresh automatically when complete.",
        icon: <Loader2 className="size-5 animate-spin" aria-hidden />,
        tone: "info",
        showCancel: true,
      };
    case "queued":
      return {
        title: "Simulation queued",
        description:
          "Your simulation is waiting for an available slot. You can keep working while we process it.",
        icon: <Clock3 className="size-5" aria-hidden />,
        tone: "info",
        showCancel: true,
      };
    case "cancelled":
      return {
        title: "Simulation cancelled",
        description:
          "Results may be out of date. Start a new simulation to refresh your dashboard metrics.",
        icon: <CircleAlert className="size-5" aria-hidden />,
        tone: "warning",
      };
    default:
      return null;
  }
};

export function SimulationStatusBanner({
  simulation,
  onCancel,
  isCancelling,
}: SimulationStatusBannerProps) {
  const bannerState = useMemo(() => {
    if (!simulation) {
      return null;
    }

    const statusKey = String(simulation.status);
    if (!DISPLAYABLE_STATUSES.has(statusKey)) {
      return null;
    }

    const descriptor = buildDescriptor(statusKey);
    if (!descriptor) {
      return null;
    }

    return { statusKey, descriptor } as const;
  }, [simulation]);

  if (!bannerState) {
    return null;
  }

  const { statusKey, descriptor } = bannerState;

  const canCancel = Boolean(onCancel) && CANCELABLE_STATUSES.has(statusKey);

  return (
    <section
      aria-live="polite"
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-lg border px-4 py-3",
        TONE_STYLES[descriptor.tone],
      )}
    >
      <div className="flex items-start gap-3">
        {descriptor.icon}
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-none">
            {descriptor.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {descriptor.description}
          </p>
        </div>
      </div>
      {canCancel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isCancelling}
          className="shrink-0"
        >
          {isCancelling ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </section>
  );
}
