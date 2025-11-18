import type { FC, ChangeEventHandler, FocusEventHandler } from "react";

interface Props {
  readonly value: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly onBlur?: FocusEventHandler<HTMLInputElement>;
  readonly previewText?: string;
}

export const MonthlyOverpaymentLimitField: FC<Props> = ({
  value,
  error,
  disabled,
  onChange,
  onBlur,
  previewText,
}) => {
  return (
    <div className="space-y-2">
      <label
        htmlFor="monthlyOverpaymentLimit"
        className="block text-sm font-medium"
      >
        Monthly overpayment limit (PLN)
      </label>
      <input
        id="monthlyOverpaymentLimit"
        name="monthlyOverpaymentLimit"
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? "monthlyOverpaymentLimit-error" : undefined}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
        placeholder="e.g. 1200.00"
      />
      {error ? (
        <p id="monthlyOverpaymentLimit-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">
            Enter a non-negative number; leave empty to default to 0 on save.
          </p>
          {previewText ? (
            <p className="text-xs text-slate-600">
              Preview: <span className="font-medium">{previewText}</span>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};
