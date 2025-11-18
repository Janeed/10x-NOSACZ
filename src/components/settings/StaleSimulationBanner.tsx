import type { FC } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  readonly visible: boolean;
  readonly onRerun: () => void;
  readonly onDismiss?: () => void;
}

export const StaleSimulationBanner: FC<Props> = ({
  visible,
  onRerun,
  onDismiss,
}) => {
  if (!visible) {
    return null;
  }
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium">
            Your active simulation may be stale after updating settings.
          </p>
          <p className="text-xs text-amber-800">
            Re-run the simulation to reflect your updated defaults and refresh
            insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={onRerun}>
            Re-run Simulation
          </Button>
          {onDismiss ? (
            <Button type="button" size="sm" variant="link" onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
