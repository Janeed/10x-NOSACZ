import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StrategyOptionVM } from "@/lib/viewModels/wizardSimulation";

interface StrategyListProps {
  readonly strategies: StrategyOptionVM[];
  readonly isLoading: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  readonly onSelect: (strategyId: string) => void;
}

const LoadingState = () => {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
      <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
      <p className="text-xs text-muted-foreground">Loading strategies…</p>
    </div>
  );
};

const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => {
  return (
    <div
      className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
      role="alert"
    >
      <p className="text-sm font-semibold text-destructive-foreground">
        Unable to load strategies.
      </p>
      <p className="text-sm text-destructive-foreground/80">{message}</p>
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
};

const EmptyState = () => {
  return (
    <div
      className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-muted-foreground">
        No strategies available at the moment.
      </p>
      <p className="text-xs text-muted-foreground/80">
        Try again later or contact support if the issue persists.
      </p>
    </div>
  );
};

export function StrategyList({
  strategies,
  isLoading,
  error,
  onRetry,
  onSelect,
}: StrategyListProps) {
  const hasStrategies = strategies.length > 0;

  const sortedStrategies = useMemo(() => {
    if (!hasStrategies) {
      return [];
    }
    return [...strategies].sort((a, b) => a.name.localeCompare(b.name));
  }, [hasStrategies, strategies]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (!hasStrategies) {
    return <EmptyState />;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Simulation strategies"
      className="flex flex-col gap-3"
    >
      {sortedStrategies.map((strategy) => {
        const isSelected = strategy.selected;

        return (
          <button
            key={strategy.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(strategy.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(strategy.id);
              }
            }}
            className={cn(
              "flex w-full flex-col gap-2 rounded-lg border px-4 py-3 text-left transition",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <span className="text-sm font-semibold leading-none">
              {strategy.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {strategy.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
