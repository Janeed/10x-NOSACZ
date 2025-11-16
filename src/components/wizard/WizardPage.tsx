import { useCallback, useMemo, useState, type ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { GoalSelector } from "@/components/wizard/GoalSelector";
import { LoansPreview } from "@/components/wizard/LoansPreview";
import { SettingsSummary } from "@/components/wizard/SettingsSummary";
import { StrategyList } from "@/components/wizard/StrategyList";
import { StatusBanner } from "@/components/wizard/StatusBanner";
import { SubmitControls } from "@/components/wizard/SubmitControls";
import { ThresholdInput } from "@/components/wizard/ThresholdInput";
import { WizardStepper } from "@/components/wizard/WizardStepper";
import { useLoansPreview } from "@/lib/hooks/useLoansPreview";
import {
  type SimulationSubmitResult,
  useSimulationSubmission,
} from "@/lib/hooks/useSimulationSubmission";
import { useSimulationWizard } from "@/lib/hooks/useSimulationWizard";
import { useStrategies } from "@/lib/hooks/useStrategies";
import { useUserSettings } from "@/lib/hooks/useUserSettings";
import { formatCurrency } from "@/lib/formatters";
import {
  WIZARD_STEP_DETAILS,
  type WizardStep,
} from "@/lib/viewModels/wizardSimulation";
import type { GoalType } from "@/types";

interface SectionCardProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly role?: string;
}

function SectionCard({ title, description, children, role }: SectionCardProps) {
  return (
    <section
      role={role}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <header className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function StepSection({
  step,
  children,
}: {
  readonly step: WizardStep;
  readonly children: ReactNode;
}) {
  const detail = WIZARD_STEP_DETAILS[step];

  return (
    <SectionCard title={detail.title} description={detail.description}>
      <div className="flex flex-col gap-4 text-foreground">{children}</div>
    </SectionCard>
  );
}

export function WizardPage() {
  const loansPreview = useLoansPreview();
  const userSettings = useUserSettings();

  const wizard = useSimulationWizard({
    hasLoans: loansPreview.hasLoans,
    loansLoaded: !loansPreview.isLoading,
  });

  const {
    state: wizardState,
    errors: wizardErrors,
    thresholdField,
    currentStep,
    selectStrategy,
    selectGoal: selectGoalInternal,
    updateThreshold: updateThresholdInternal,
    touchThreshold,
    goToStep,
    canGoToStep,
    isStepComplete,
  } = wizard;

  const strategiesState = useStrategies({
    selectedStrategyId: wizardState.selectedStrategyId,
  });
  const selectedStrategy = useMemo(() => {
    return strategiesState.strategies.find((item) => item.selected) ?? null;
  }, [strategiesState.strategies]);

  const strategyErrorMessage = strategiesState.error?.message ?? null;
  const reinvestSetting = userSettings.settings?.reinvestReducedPayments;
  const submission = useSimulationSubmission();
  const [thresholdServerError, setThresholdServerError] = useState<
    string | null
  >(null);

  const thresholdError =
    thresholdServerError ??
    thresholdField.error ??
    wizardErrors.threshold ??
    null;
  const submissionBusy =
    submission.submitting ||
    submission.status.phase === "queued" ||
    submission.status.phase === "running";

  const handleSelectGoal = useCallback(
    (goal: GoalType) => {
      setThresholdServerError(null);
      selectGoalInternal(goal);
    },
    [selectGoalInternal],
  );

  const handleThresholdChange = useCallback(
    (value: number | string | "") => {
      setThresholdServerError(null);
      updateThresholdInternal(value);
    },
    [updateThresholdInternal],
  );

  const processSubmitResult = useCallback(
    (result: SimulationSubmitResult) => {
      if (result.ok) {
        setThresholdServerError(null);
        return;
      }

      if (result.type === "validation") {
        const issues = result.error.issues ?? [];
        const thresholdIssue = issues.find((issue) => {
          const path = issue.path?.toLowerCase();
          if (!path) {
            return false;
          }
          return (
            path.includes("paymentreductiontarget") ||
            path.includes("payment_reduction_target") ||
            path.includes("threshold")
          );
        });

        if (thresholdIssue) {
          setThresholdServerError(
            thresholdIssue.message ?? result.error.message,
          );
          touchThreshold();
          goToStep("goal");
        }
      }
    },
    [goToStep, touchThreshold],
  );

  const handleSubmit = useCallback(async () => {
    if (!wizardState.selectedStrategyId) {
      goToStep("strategy");
      return;
    }

    if (!wizardState.goal) {
      goToStep("goal");
      return;
    }

    setThresholdServerError(null);

    const result = await submission.submit({
      strategyId: wizardState.selectedStrategyId,
      goal: wizardState.goal,
      reinvestReducedPayments: reinvestSetting ?? false,
      monthlyOverpaymentLimit:
        userSettings.settings?.overpaymentLimit ?? undefined,
      paymentReductionTarget:
        wizardState.goal === "payment_reduction"
          ? (wizardState.threshold ?? undefined)
          : undefined,
    });

    processSubmitResult(result);
  }, [
    goToStep,
    processSubmitResult,
    reinvestSetting,
    submission,
    userSettings.settings,
    wizardState.goal,
    wizardState.selectedStrategyId,
    wizardState.threshold,
  ]);

  const handleRetry = useCallback(async () => {
    const result = await submission.retry();
    processSubmitResult(result);
  }, [processSubmitResult, submission]);

  const handleCancel = useCallback(async () => {
    await submission.cancel();
  }, [submission]);

  const canSubmit = useMemo(() => {
    if (!wizardState.canSubmit) {
      return false;
    }

    if (
      strategiesState.isLoading ||
      userSettings.isLoading ||
      loansPreview.isLoading
    ) {
      return false;
    }

    if (userSettings.settings === null) {
      return false;
    }

    if (submissionBusy) {
      return false;
    }

    return true;
  }, [
    loansPreview.isLoading,
    strategiesState.isLoading,
    submissionBusy,
    userSettings.isLoading,
    userSettings.settings,
    wizardState.canSubmit,
  ]);

  const disableReason = useMemo(() => {
    if (submissionBusy || submission.submitting) {
      return null;
    }

    if (!wizardState.canSubmit) {
      return (
        wizardErrors.strategy ??
        wizardErrors.goal ??
        wizardErrors.threshold ??
        wizardErrors.loans ??
        "Complete all required steps before submitting."
      );
    }

    if (strategiesState.isLoading) {
      return "Strategies are still loading.";
    }

    if (userSettings.isLoading) {
      return "Settings are still loading.";
    }

    if (userSettings.settings === null) {
      return "Unable to load settings. Please try again.";
    }

    if (loansPreview.isLoading) {
      return "Loan data is still loading.";
    }

    if (!loansPreview.hasLoans) {
      return "Add at least one loan before running a simulation.";
    }

    return null;
  }, [
    loansPreview.hasLoans,
    loansPreview.isLoading,
    strategiesState.isLoading,
    submission.submitting,
    submissionBusy,
    userSettings.isLoading,
    userSettings.settings,
    wizardErrors.goal,
    wizardErrors.loans,
    wizardErrors.strategy,
    wizardErrors.threshold,
    wizardState.canSubmit,
  ]);

  const renderStepContent = () => {
    switch (currentStep) {
      case "strategy":
        return (
          <>
            <StrategyList
              strategies={strategiesState.strategies}
              isLoading={strategiesState.isLoading}
              error={strategyErrorMessage}
              onRetry={strategiesState.refetch}
              onSelect={selectStrategy}
            />
            {wizardErrors.strategy ? (
              <p className="text-xs text-destructive">
                {wizardErrors.strategy}
              </p>
            ) : null}
            {wizardErrors.loans ? (
              <p className="text-xs text-destructive">{wizardErrors.loans}</p>
            ) : null}
          </>
        );
      case "goal":
        return (
          <div className="flex flex-col gap-6">
            <GoalSelector
              goal={wizardState.goal}
              onSelect={handleSelectGoal}
              reinvestReducedPayments={reinvestSetting}
              error={wizardErrors.goal}
            />
            {wizardState.goal === "payment_reduction" ? (
              <ThresholdInput
                value={thresholdField.value}
                onChange={handleThresholdChange}
                onBlur={touchThreshold}
                error={thresholdError}
              />
            ) : null}
            {wizardErrors.threshold &&
            wizardState.goal !== "payment_reduction" ? (
              <p className="text-xs text-destructive">
                {wizardErrors.threshold}
              </p>
            ) : null}
          </div>
        );
      case "review":
        return (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-background/60 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Selected strategy
              </h3>
              {strategiesState.isLoading && !selectedStrategy ? (
                <p className="text-xs text-muted-foreground">
                  Loading strategy details…
                </p>
              ) : null}
              {selectedStrategy ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {selectedStrategy.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedStrategy.description}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-destructive">
                  Strategy selection missing. Go back to the first step to pick
                  a strategy.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background/60 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Goal configuration
              </h3>
              <dl className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Goal</dt>
                  <dd className="font-medium text-foreground">
                    {wizardState.goal === "fastest_payoff"
                      ? "Fastest payoff"
                      : wizardState.goal === "payment_reduction"
                        ? "Payment reduction"
                        : "Not selected"}
                  </dd>
                </div>
                {wizardState.goal === "payment_reduction" ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Reduction target</dt>
                    <dd className="font-medium text-foreground">
                      {formatCurrency(wizardState.threshold)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Reinvest reduced payments
                  </dt>
                  <dd className="font-medium text-foreground">
                    {userSettings.isLoading
                      ? "Loading…"
                      : userSettings.settings
                        ? userSettings.settings.reinvestReducedPayments
                          ? "Enabled"
                          : "Disabled"
                        : "Unavailable"}
                  </dd>
                </div>
              </dl>
              {wizardErrors.threshold ? (
                <p className="mt-2 text-xs text-destructive">
                  {wizardErrors.threshold}
                </p>
              ) : null}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell activeNav="dashboard" title="Run simulation wizard">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Run a new simulation
          </h1>
          <p className="text-sm text-muted-foreground">
            Follow the guided steps to select a repayment strategy, set your
            goal, and launch a fresh simulation.
          </p>
        </header>

        <SectionCard
          title="Simulation status"
          description="Live updates for submission, cancellation, and conflicts will appear here."
          role="status"
        >
          <StatusBanner
            status={submission.status}
            submitting={submission.submitting}
            onRetry={handleRetry}
            onCancelAndRetry={
              submission.status.phase === "conflict" ? handleRetry : undefined
            }
          />
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <WizardStepper
              currentStep={currentStep}
              canGoToStep={canGoToStep}
              onStepChange={goToStep}
              isStepComplete={isStepComplete}
            />

            <StepSection step={currentStep}>{renderStepContent()}</StepSection>
          </div>

          <aside className="flex flex-col gap-4">
            <SectionCard
              title="Settings summary"
              description="Displays your overpayment limit and reinvest configuration with a shortcut to settings."
            >
              <SettingsSummary
                settings={userSettings.settings}
                isLoading={userSettings.isLoading}
                error={userSettings.error}
                onRetry={() => userSettings.refetch({ force: true })}
              />
            </SectionCard>

            <SectionCard
              title="Loans preview"
              description="Shows your active loans to inform the strategy and goal selections."
            >
              <LoansPreview
                loans={loansPreview.loans}
                isLoading={loansPreview.isLoading}
                error={loansPreview.error}
                onRetry={loansPreview.refetch}
              />
            </SectionCard>
          </aside>
        </div>

        <SectionCard
          title="Submit controls"
          description="Primary and secondary actions for running or cancelling the simulation."
        >
          <SubmitControls
            canSubmit={canSubmit}
            submitting={submission.submitting}
            cancelling={submission.cancelling}
            status={submission.status}
            disableReason={disableReason}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onRetry={handleRetry}
          />
        </SectionCard>
      </main>
    </AppShell>
  );
}
