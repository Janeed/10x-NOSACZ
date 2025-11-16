import { useId } from "react";

import { cn } from "@/lib/utils";
import type { GoalType } from "@/types";

interface GoalOption {
  readonly value: GoalType;
  readonly title: string;
  readonly description: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    value: "fastest_payoff",
    title: "Fastest payoff",
    description:
      "Allocate overpayments to minimise the payoff timeline and finish your loans sooner.",
  },
  {
    value: "payment_reduction",
    title: "Payment reduction",
    description:
      "Optimise for lower monthly obligations by targeting a payment reduction threshold.",
  },
];

interface GoalSelectorProps {
  readonly goal?: GoalType;
  readonly onSelect: (goal: GoalType) => void;
  readonly reinvestReducedPayments?: boolean;
  readonly error?: string | null;
}

export function GoalSelector({
  goal,
  onSelect,
  reinvestReducedPayments,
  error,
}: GoalSelectorProps) {
  const groupId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="flex flex-col gap-3"
      >
        <div
          id={`${groupId}-label`}
          className="text-sm font-medium text-foreground"
        >
          Choose your simulation goal
        </div>
        {GOAL_OPTIONS.map((option) => {
          const isSelected = goal === option.value;
          const optionId = `${groupId}-${option.value}`;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              id={optionId}
              onClick={() => onSelect(option.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(option.value);
                }
              }}
              className={cn(
                "flex w-full flex-col gap-2 rounded-lg border px-4 py-3 text-left transition",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              <span className="text-sm font-semibold leading-none text-foreground">
                {option.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
              {option.value === "payment_reduction" ? (
                <span className="text-xs text-muted-foreground">
                  Set a reduction amount below. This option is ideal when
                  prioritising cash-flow relief.
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {reinvestReducedPayments !== undefined ? (
        <p className="text-xs text-muted-foreground">
          Reinvest reduced payments is{" "}
          <span className="font-medium text-foreground">
            {reinvestReducedPayments ? "enabled" : "disabled"}
          </span>
          . Update this under settings if you need to change how reclaimed
          amounts are applied.
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
