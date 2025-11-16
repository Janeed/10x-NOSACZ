import { useCallback, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WIZARD_STEP_DETAILS,
  WIZARD_STEPS,
  type WizardStep,
} from "@/lib/viewModels/wizardSimulation";

interface WizardStepperProps {
  readonly currentStep: WizardStep;
  readonly canGoToStep: (step: WizardStep) => boolean;
  readonly onStepChange: (step: WizardStep) => void;
  readonly isStepComplete: (step: WizardStep) => boolean;
}

export function WizardStepper({
  currentStep,
  canGoToStep,
  onStepChange,
  isStepComplete,
}: WizardStepperProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, step: WizardStep) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      const currentIndex = WIZARD_STEPS.indexOf(step);
      if (currentIndex === -1) {
        return;
      }

      if (event.key === "ArrowLeft") {
        const previous = WIZARD_STEPS[currentIndex - 1];
        if (previous && canGoToStep(previous)) {
          onStepChange(previous);
        }
      }

      if (event.key === "ArrowRight") {
        const next = WIZARD_STEPS[currentIndex + 1];
        if (next && canGoToStep(next)) {
          onStepChange(next);
        }
      }
    },
    [canGoToStep, onStepChange],
  );

  return (
    <nav
      aria-label="Wizard steps"
      className="rounded-xl border border-border bg-card p-4"
    >
      <ol className="flex flex-col gap-3">
        {WIZARD_STEPS.map((step, index) => {
          const detail = WIZARD_STEP_DETAILS[step];
          const isActive = currentStep === step;
          const isComplete = isStepComplete(step);
          const isDisabled = !isActive && !canGoToStep(step);

          return (
            <li key={step} className="flex">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onStepChange(step)}
                onKeyDown={(event) => handleKeyDown(event, step)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 hover:bg-primary/5",
                  isDisabled && "pointer-events-none opacity-50",
                )}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={isDisabled || undefined}
                disabled={isDisabled}
              >
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                    isComplete
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card",
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-sm font-medium leading-tight">
                    {detail.title}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    {detail.description}
                  </span>
                </span>
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
