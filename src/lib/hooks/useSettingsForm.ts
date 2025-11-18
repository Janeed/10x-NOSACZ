import { useCallback, useEffect, useMemo, useState } from "react";

import type { UpdateUserSettingsCommand, UserSettingsDto } from "@/types";
import type {
  SettingsFormErrors,
  SettingsFormValues,
} from "@/lib/viewModels/settings";

const parseLimit = (raw: string): number | null => {
  if (raw.trim() === "") {
    return null;
  }
  const normalized = raw.replace(",", ".").trim();
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
};

export interface UseSettingsFormResult {
  readonly values: SettingsFormValues;
  readonly errors: SettingsFormErrors;
  readonly isDirty: boolean;
  readonly hasErrors: boolean;
  readonly setMonthlyLimit: (value: string) => void;
  readonly setReinvest: (checked: boolean) => void;
  readonly blurMonthlyLimit: () => void;
  readonly validate: () => boolean;
  readonly reset: (nextDto?: UserSettingsDto) => void;
  readonly buildCommand: () => UpdateUserSettingsCommand | null;
  readonly setNonFieldError: (message?: string) => void;
  readonly clearErrors: () => void;
}

export function useSettingsForm(
  initialDto?: UserSettingsDto,
): UseSettingsFormResult {
  const [snapshot, setSnapshot] = useState<UserSettingsDto | undefined>(
    initialDto,
  );
  const [values, setValues] = useState<SettingsFormValues>(() => ({
    monthlyOverpaymentLimit:
      initialDto && typeof initialDto.monthlyOverpaymentLimit === "number"
        ? String(initialDto.monthlyOverpaymentLimit)
        : "",
    reinvestReducedPayments: initialDto?.reinvestReducedPayments ?? false,
  }));
  const [errors, setErrors] = useState<SettingsFormErrors>({});

  useEffect(() => {
    if (initialDto?.updatedAt !== snapshot?.updatedAt) {
      setSnapshot(initialDto);
      setValues({
        monthlyOverpaymentLimit:
          initialDto && typeof initialDto.monthlyOverpaymentLimit === "number"
            ? String(initialDto.monthlyOverpaymentLimit)
            : "",
        reinvestReducedPayments: initialDto?.reinvestReducedPayments ?? false,
      });
      setErrors({});
    }
  }, [initialDto, snapshot?.updatedAt]);

  // dirty state computed later using numeric equality

  const setMonthlyLimit = useCallback((value: string) => {
    setValues((current) => ({ ...current, monthlyOverpaymentLimit: value }));
  }, []);

  const setReinvest = useCallback((checked: boolean) => {
    setValues((current) => ({ ...current, reinvestReducedPayments: checked }));
  }, []);

  const blurMonthlyLimit = useCallback(() => {
    const normalized = values.monthlyOverpaymentLimit.replace(",", ".").trim();
    const parsed = parseLimit(normalized);
    setValues((current) => ({
      ...current,
      monthlyOverpaymentLimit: parsed === null ? normalized : parsed.toFixed(2),
    }));
    // lazy validate on blur
    setErrors((current) => ({
      ...current,
      monthlyOverpaymentLimit:
        normalized === ""
          ? undefined
          : parsed === null
            ? "Enter a valid non-negative number"
            : undefined,
    }));
  }, [values.monthlyOverpaymentLimit]);

  const validate = useCallback((): boolean => {
    const nextErrors: SettingsFormErrors = {};
    const parsed = parseLimit(values.monthlyOverpaymentLimit);
    if (values.monthlyOverpaymentLimit !== "" && parsed === null) {
      nextErrors.monthlyOverpaymentLimit = "Enter a valid non-negative number";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [values.monthlyOverpaymentLimit]);

  const buildCommand = useCallback((): UpdateUserSettingsCommand | null => {
    const ok = validate();
    if (!ok) {
      return null;
    }
    const parsed = parseLimit(values.monthlyOverpaymentLimit);
    const monthlyLimit = parsed === null ? 0 : parsed;
    return {
      monthlyOverpaymentLimit: monthlyLimit,
      reinvestReducedPayments: values.reinvestReducedPayments,
    };
  }, [
    validate,
    values.monthlyOverpaymentLimit,
    values.reinvestReducedPayments,
  ]);

  const reset = useCallback(
    (nextDto?: UserSettingsDto) => {
      const base = nextDto ?? snapshot;
      setSnapshot(base);
      setValues({
        monthlyOverpaymentLimit:
          base && typeof base.monthlyOverpaymentLimit === "number"
            ? String(base.monthlyOverpaymentLimit)
            : "",
        reinvestReducedPayments: base?.reinvestReducedPayments ?? false,
      });
      setErrors({});
    },
    [snapshot],
  );

  const setNonFieldError = useCallback((message?: string) => {
    setErrors((current) => ({ ...current, nonFieldError: message }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  // Determine dirty state using numeric equality to avoid false positives from formatting
  const isDirty = useMemo(() => {
    const baseLimitNumber =
      typeof snapshot?.monthlyOverpaymentLimit === "number"
        ? snapshot.monthlyOverpaymentLimit
        : undefined;
    const currentNumber = parseLimit(values.monthlyOverpaymentLimit);

    const limitChanged = (() => {
      // Create mode and empty or zero treated as unchanged
      if (baseLimitNumber === undefined) {
        if (currentNumber === null || currentNumber === 0) {
          return false;
        }
        return true;
      }
      if (currentNumber === null) {
        // user cleared an existing number
        return true;
      }
      return Number(baseLimitNumber) !== Number(currentNumber);
    })();

    const reinvestChanged =
      (snapshot?.reinvestReducedPayments ?? false) !==
      values.reinvestReducedPayments;

    return limitChanged || reinvestChanged;
  }, [
    snapshot,
    values.monthlyOverpaymentLimit,
    values.reinvestReducedPayments,
  ]);

  return {
    values,
    errors,
    isDirty,
    hasErrors,
    setMonthlyLimit,
    setReinvest,
    blurMonthlyLimit,
    validate,
    reset,
    buildCommand,
    setNonFieldError,
    clearErrors,
  } as const;
}
