import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SimulationStaleBannerProps {
  readonly stale: boolean;
  readonly onRerun?: () => void;
  readonly rerouteHref?: string;
}

export function SimulationStaleBanner({
  stale,
  onRerun,
  rerouteHref = "/wizard",
}: SimulationStaleBannerProps) {
  if (!stale) {
    return null;
  }

  const showAction = typeof onRerun === "function";
  const actionLabel = showAction ? "Re-run simulation" : "Open wizard";

  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3",
        "text-amber-900 dark:text-amber-200",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-none">
            Simulation results may be stale
          </p>
          <p className="text-sm text-muted-foreground">
            Recent changes need a new simulation run to update projections and
            current month actions.
          </p>
        </div>
      </div>
      {showAction ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRerun}
          className="shrink-0"
        >
          {actionLabel}
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <a href={rerouteHref}>{actionLabel}</a>
        </Button>
      )}
    </section>
  );
}
