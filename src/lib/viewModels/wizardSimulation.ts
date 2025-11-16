import type {
  GoalType,
  LoanDto,
  SimulationStatus,
  StrategyDto,
  UserSettingsDto,
} from "@/types";

export type WizardStep = "strategy" | "goal" | "review";

export const WIZARD_STEPS = [
  "strategy",
  "goal",
  "review",
] as const satisfies readonly WizardStep[];

export const WIZARD_STEP_DETAILS: Record<
  WizardStep,
  { title: string; description: string }
> = {
  strategy: {
    title: "Select strategy",
    description: "Choose the repayment strategy to simulate.",
  },
  goal: {
    title: "Set goal",
    description: "Configure your payoff goal and optional threshold.",
  },
  review: {
    title: "Review & submit",
    description: "Confirm details before running the simulation.",
  },
} as const;

export interface WizardState {
  readonly step: WizardStep;
  readonly selectedStrategyId?: string;
  readonly goal?: GoalType;
  readonly threshold?: number;
  readonly thresholdValid: boolean;
  readonly canSubmit: boolean;
}

export interface StrategyOptionVM extends StrategyDto {
  readonly selected: boolean;
}

export interface GoalSelectionState {
  readonly goal?: GoalType;
}

export interface ThresholdFieldState {
  readonly value: number | "";
  readonly touched: boolean;
  readonly valid: boolean;
  readonly error?: string;
}

export interface LoanPreviewVM extends LoanDto {
  readonly remainingTermMonths: number;
  readonly highlight?: "highRate" | "smallBalance";
}

export interface SettingsSummaryVM {
  readonly overpaymentLimit: UserSettingsDto["monthlyOverpaymentLimit"];
  readonly reinvestReducedPayments: UserSettingsDto["reinvestReducedPayments"];
}

export interface SubmitState {
  readonly canSubmit: boolean;
  readonly submitting: boolean;
  readonly conflict: boolean;
}

export interface SimulationSubmitResult {
  readonly simulationId: string;
  readonly status: SimulationStatus;
}

export type SimulationPhase =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "cancelled"
  | "error"
  | "conflict";

export interface SimulationStatusVM {
  readonly phase: SimulationPhase;
  readonly simulationId?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly message?: string;
  readonly errorCode?: string;
}

export interface WizardValidationErrors {
  readonly strategy?: string;
  readonly goal?: string;
  readonly threshold?: string;
  readonly loans?: string;
}

export interface CancellationResult {
  readonly previousCancelled: boolean;
  readonly newStarted: boolean;
  readonly previousId?: string;
  readonly newId?: string;
}
