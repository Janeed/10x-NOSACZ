import type { FC, FormEvent } from "react";

import type {
  SettingsFormErrors,
  SettingsFormValues,
} from "@/lib/viewModels/settings";
import { MonthlyOverpaymentLimitField } from "@/components/settings/MonthlyOverpaymentLimitField";
import { ReinvestToggle } from "@/components/settings/ReinvestToggle";
import { FormActions } from "@/components/settings/FormActions";

interface Props {
  readonly values: SettingsFormValues;
  readonly errors: SettingsFormErrors;
  readonly saving?: boolean;
  readonly disabled?: boolean;
  readonly isDirty?: boolean;
  readonly previewText?: string;
  readonly onChangeMonthlyLimit: (value: string) => void;
  readonly onBlurMonthlyLimit: () => void;
  readonly onChangeReinvest: (checked: boolean) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

export const SettingsForm: FC<Props> = ({
  values,
  errors,
  saving = false,
  disabled = false,
  isDirty = false,
  previewText,
  onChangeMonthlyLimit,
  onBlurMonthlyLimit,
  onChangeReinvest,
  onSubmit,
  onCancel,
}) => {
  const hasErrors = Boolean(
    errors.monthlyOverpaymentLimit || errors.nonFieldError,
  );

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-6" onSubmit={handleFormSubmit} noValidate>
      {errors.nonFieldError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors.nonFieldError}
        </div>
      ) : null}
      <MonthlyOverpaymentLimitField
        value={values.monthlyOverpaymentLimit}
        error={errors.monthlyOverpaymentLimit}
        disabled={disabled || saving}
        onChange={(e) => onChangeMonthlyLimit(e.target.value)}
        onBlur={onBlurMonthlyLimit}
        previewText={previewText}
      />
      <ReinvestToggle
        checked={values.reinvestReducedPayments}
        disabled={disabled || saving}
        onChange={(e) => onChangeReinvest(e.target.checked)}
      />
      <FormActions
        onCancel={onCancel}
        saving={saving}
        isDirty={isDirty}
        hasErrors={hasErrors}
        disabled={disabled}
      />
    </form>
  );
};
