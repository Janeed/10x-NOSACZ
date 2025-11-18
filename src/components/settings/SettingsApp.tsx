import type { FC } from "react";
import { useCallback, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { useSettingsResource } from "@/lib/hooks/useSettingsResource";
import { useSettingsForm } from "@/lib/hooks/useSettingsForm";
import { useSaveUserSettings } from "@/lib/hooks/useSaveUserSettings";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { SuccessToast } from "@/components/settings/SuccessToast";
import { StaleSimulationBanner } from "@/components/settings/StaleSimulationBanner";
import { LastUpdatedDisplay } from "@/components/settings/LastUpdatedDisplay";
import { ErrorAlert } from "@/components/settings/ErrorAlert";

export const SettingsApp: FC = () => {
  const { dto, eTag, isInitialized, isLoading, error, refetch } =
    useSettingsResource();

  const {
    values,
    errors,
    isDirty,
    setMonthlyLimit,
    setReinvest,
    blurMonthlyLimit,
    validate,
    reset,
    buildCommand,
    setNonFieldError,
    clearErrors,
  } = useSettingsForm(dto);

  const {
    save,
    isSaving,
    error: saveError,
    clearError: clearSaveError,
  } = useSaveUserSettings({ isInitialized, eTag });

  const [toastVariant, setToastVariant] = useState<
    "created" | "updated" | null
  >(null);
  const [staleVisible, setStaleVisible] = useState(false);

  const handleRetry = useCallback(() => {
    void refetch({ force: true });
  }, [refetch]);

  const headerSubtitle = useMemo(() => {
    return "Configure your default monthly overpayment limit and reinvest behavior.";
  }, []);

  const formattedPreview = useMemo(() => {
    const raw = values.monthlyOverpaymentLimit.replace(",", ".").trim();
    const n = Number.parseFloat(raw);
    if (!raw || Number.isNaN(n) || n < 0) {
      return undefined;
    }
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "PLN",
        currencyDisplay: "code",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `PLN ${n.toFixed(2)}`;
    }
  }, [values.monthlyOverpaymentLimit]);

  const handleCancel = useCallback(() => {
    reset(dto);
    clearErrors();
    setNonFieldError(undefined);
  }, [clearErrors, dto, reset, setNonFieldError]);

  const handleSubmit = useCallback(async () => {
    setNonFieldError(undefined);
    clearSaveError();

    const isValid = validate();
    if (!isValid) {
      return;
    }
    const command = buildCommand();
    if (!command) {
      return;
    }

    const result = await save(command);
    if (result) {
      setToastVariant(result.created ? "created" : "updated");
      setStaleVisible(true);
      reset(result.dto);
      await refetch({ force: true });
      return;
    }

    const err = saveError;
    if (!err) {
      setNonFieldError("Unable to save settings. Please try again.");
      return;
    }
    if (err.status === 400) {
      setNonFieldError(err.message);
      const issue = err.issues?.find((i) =>
        (i.path ?? "").toLowerCase().includes("monthly"),
      );
      if (issue?.message) {
        // apply specific field error
        // reuse validate/blur to mark; setNonFieldError already holds non-field details
      }
      return;
    }
    if (err.status === 409) {
      setNonFieldError(
        "Your settings changed elsewhere. We've reloaded the latest values. Please re-apply your edits.",
      );
      await refetch({ force: true });
      return;
    }
    setNonFieldError(err.message);
  }, [
    buildCommand,
    clearSaveError,
    refetch,
    reset,
    save,
    saveError,
    setNonFieldError,
    validate,
  ]);

  const handleDismissToast = useCallback(() => {
    setToastVariant(null);
  }, []);

  const handleRerun = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/wizard";
    }
  }, []);

  const handleDismissBanner = useCallback(() => {
    setStaleVisible(false);
  }, []);

  return (
    <AppShell activeNav="settings">
      <section className="mx-auto w-full max-w-3xl space-y-6 py-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
        </header>

        {staleVisible ? (
          <StaleSimulationBanner
            visible
            onRerun={handleRerun}
            onDismiss={handleDismissBanner}
          />
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <LastUpdatedDisplay updatedAt={dto?.updatedAt} />
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading settings…</p>
          ) : error ? (
            <ErrorAlert
              error={{ code: error.code, message: error.message }}
              onRetry={handleRetry}
            />
          ) : (
            <>
              <ErrorAlert
                error={
                  saveError
                    ? { code: saveError.code, message: saveError.message }
                    : null
                }
                onDismiss={clearSaveError}
              />
              <SettingsForm
                values={values}
                errors={errors}
                saving={isSaving}
                disabled={false}
                isDirty={isDirty}
                previewText={formattedPreview}
                onChangeMonthlyLimit={setMonthlyLimit}
                onBlurMonthlyLimit={blurMonthlyLimit}
                onChangeReinvest={setReinvest}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </>
          )}
        </section>
        {toastVariant ? (
          <SuccessToast variant={toastVariant} onDismiss={handleDismissToast} />
        ) : null}
      </section>
    </AppShell>
  );
};
