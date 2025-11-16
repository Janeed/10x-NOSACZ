import { useCallback, useMemo, useState } from "react";

import type { GoalType } from "@/types";
import type {
  ThresholdFieldState,
  WizardState,
  WizardStep,
  WizardValidationErrors,
} from "@/lib/viewModels/wizardSimulation";
import { WIZARD_STEPS } from "@/lib/viewModels/wizardSimulation";

interface UseSimulationWizardOptions {
  readonly hasLoans?: boolean;
  readonly loansLoaded?: boolean;
}

interface ThresholdEvaluation {
  readonly valid: boolean;
  readonly message?: string;
  readonly numericValue?: number;
}

interface UseSimulationWizardResult {
  readonly state: WizardState;
  readonly currentStep: WizardStep;
  readonly errors: WizardValidationErrors;
  readonly thresholdField: ThresholdFieldState;
  readonly selectStrategy: (strategyId: string) => void;
  readonly selectGoal: (goal: GoalType) => void;
  readonly updateThreshold: (value: number | string | "") => void;
  readonly touchThreshold: () => void;
  readonly clearThreshold: () => void;
  readonly goToStep: (step: WizardStep) => void;
  readonly goNext: () => void;
  readonly goPrevious: () => void;
  readonly canGoToStep: (step: WizardStep) => boolean;
  readonly isStepComplete: (step: WizardStep) => boolean;
}

const parseThresholdValue = (value: number | string | ""): number | "" => {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }

  const normalized = String(value).trim().replace(/,/g, ".");
  if (normalized.length === 0) {
    return "";
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return parsed;
};

const evaluateThreshold = (
  rawValue: number | "",
  goal: GoalType | undefined,
): ThresholdEvaluation => {
  if (goal !== "payment_reduction") {
    return { valid: true } satisfies ThresholdEvaluation;
  }

  if (rawValue === "") {
    return {
      valid: false,
      message: "Enter a payment reduction target.",
    } satisfies ThresholdEvaluation;
  }

  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return {
      valid: false,
      message: "Enter a valid numeric amount.",
    } satisfies ThresholdEvaluation;
  }

  if (rawValue <= 0) {
    return {
      valid: false,
      message: "Threshold must be greater than zero.",
    } satisfies ThresholdEvaluation;
  }

  return {
    valid: true,
    numericValue: rawValue,
  } satisfies ThresholdEvaluation;
};

const DEFAULT_LOANS_LOADED = true;

export function useSimulationWizard(
  options: UseSimulationWizardOptions = {},
): UseSimulationWizardResult {
  const { hasLoans = false, loansLoaded = DEFAULT_LOANS_LOADED } = options;

  const [currentStep, setCurrentStep] = useState<WizardStep>("strategy");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>();
  const [goal, setGoal] = useState<GoalType>();
  const [thresholdValue, setThresholdValue] = useState<number | "">("");
  const [thresholdTouched, setThresholdTouched] = useState<boolean>(false);

  const thresholdEvaluation = useMemo(() => {
    return evaluateThreshold(thresholdValue, goal);
  }, [goal, thresholdValue]);

  const errors = useMemo<WizardValidationErrors>(() => {
    const validation: Partial<Record<keyof WizardValidationErrors, string>> =
      {};

    if (!selectedStrategyId) {
      validation.strategy = "Select a repayment strategy to continue.";
    }

    if (!goal) {
      validation.goal = "Select a goal to continue.";
    }

    const requiresThreshold = goal === "payment_reduction";
    if (requiresThreshold && !thresholdEvaluation.valid) {
      validation.threshold =
        thresholdEvaluation.message ??
        "Enter a valid payment reduction target.";
    }

    if (loansLoaded && !hasLoans) {
      validation.loans =
        "Add at least one open loan before running a simulation.";
    }

    return validation as WizardValidationErrors;
  }, [
    goal,
    hasLoans,
    loansLoaded,
    selectedStrategyId,
    thresholdEvaluation.message,
    thresholdEvaluation.valid,
  ]);

  const thresholdField = useMemo<ThresholdFieldState>(() => {
    const requiresThreshold = goal === "payment_reduction";
    const isValid = requiresThreshold ? thresholdEvaluation.valid : true;
    const numericError = requiresThreshold
      ? thresholdEvaluation.message
      : undefined;

    return {
      value: thresholdValue,
      touched: thresholdTouched,
      valid: isValid,
      error: thresholdTouched ? numericError : undefined,
    } satisfies ThresholdFieldState;
  }, [
    goal,
    thresholdEvaluation.message,
    thresholdEvaluation.valid,
    thresholdTouched,
    thresholdValue,
  ]);

  const canSubmit = useMemo(() => {
    const hasErrors = Boolean(
      errors.strategy ?? errors.goal ?? errors.threshold ?? errors.loans,
    );
    return !hasErrors;
  }, [errors.goal, errors.loans, errors.strategy, errors.threshold]);

  const wizardState = useMemo<WizardState>(() => {
    const thresholdValid =
      goal === "payment_reduction" ? thresholdEvaluation.valid : true;
    const resolvedThreshold =
      goal === "payment_reduction" && thresholdEvaluation.valid
        ? thresholdEvaluation.numericValue
        : undefined;

    return {
      step: currentStep,
      selectedStrategyId,
      goal,
      threshold: resolvedThreshold,
      thresholdValid,
      canSubmit,
    } satisfies WizardState;
  }, [
    canSubmit,
    currentStep,
    goal,
    selectedStrategyId,
    thresholdEvaluation.numericValue,
    thresholdEvaluation.valid,
  ]);

  const canGoToStep = useCallback(
    (step: WizardStep) => {
      const targetIndex = WIZARD_STEPS.indexOf(step);
      const currentIndex = WIZARD_STEPS.indexOf(currentStep);

      if (targetIndex === -1) {
        return false;
      }

      if (targetIndex <= currentIndex) {
        return true;
      }

      if (step === "goal") {
        return !errors.strategy;
      }

      if (step === "review") {
        return canSubmit;
      }

      return false;
    },
    [canSubmit, currentStep, errors.strategy],
  );

  const goToStep = useCallback(
    (step: WizardStep) => {
      if (!canGoToStep(step)) {
        return;
      }
      setCurrentStep(step);
    },
    [canGoToStep],
  );

  const goNext = useCallback(() => {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= WIZARD_STEPS.length) {
      return;
    }

    const nextStep = WIZARD_STEPS[nextIndex];
    goToStep(nextStep);
  }, [currentStep, goToStep]);

  const goPrevious = useCallback(() => {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep);
    const prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      return;
    }

    const prevStep = WIZARD_STEPS[prevIndex];
    goToStep(prevStep);
  }, [currentStep, goToStep]);

  const selectStrategy = useCallback((strategyId: string) => {
    setSelectedStrategyId(strategyId);
  }, []);

  const selectGoal = useCallback((nextGoal: GoalType) => {
    setGoal(nextGoal);

    if (nextGoal !== "payment_reduction") {
      setThresholdValue("");
      setThresholdTouched(false);
    }
  }, []);

  const updateThreshold = useCallback((value: number | string | "") => {
    const normalized = parseThresholdValue(value);
    setThresholdValue(normalized);
  }, []);

  const touchThreshold = useCallback(() => {
    setThresholdTouched(true);
  }, []);

  const clearThreshold = useCallback(() => {
    setThresholdValue("");
    setThresholdTouched(false);
  }, []);

  const isStepComplete = useCallback(
    (step: WizardStep) => {
      switch (step) {
        case "strategy":
          return Boolean(selectedStrategyId);
        case "goal":
          if (!selectedStrategyId || !goal) {
            return false;
          }
          if (goal === "payment_reduction") {
            return thresholdEvaluation.valid;
          }
          return true;
        case "review":
          return wizardState.canSubmit;
        default:
          return false;
      }
    },
    [
      goal,
      selectedStrategyId,
      thresholdEvaluation.valid,
      wizardState.canSubmit,
    ],
  );

  return {
    state: wizardState,
    currentStep,
    errors,
    thresholdField,
    selectStrategy,
    selectGoal,
    updateThreshold,
    touchThreshold,
    clearThreshold,
    goToStep,
    goNext,
    goPrevious,
    canGoToStep,
    isStepComplete,
  } as const;
}
