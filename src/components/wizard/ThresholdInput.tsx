import { useId, type ChangeEvent } from "react";

interface ThresholdInputProps {
  readonly value: number | "";
  readonly onChange: (value: number | string | "") => void;
  readonly onBlur?: () => void;
  readonly error?: string | null;
  readonly disabled?: boolean;
}

export function ThresholdInput({
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
}: ThresholdInputProps) {
  const inputId = useId();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === "") {
      onChange("");
      return;
    }
    onChange(raw);
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        Payment reduction target
      </label>
      <div className="flex flex-col gap-1">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          min="0"
          step="100"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          value={value === "" ? "" : String(value)}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <p className="text-xs text-muted-foreground">
          Enter the amount (in PLN) you want your payments reduced by each
          month. The backend will validate this before running the simulation.
        </p>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
