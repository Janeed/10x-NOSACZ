import { forwardRef, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

export interface TextInputProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly error?: string;
  readonly description?: string;
  readonly autoComplete?: "email";
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * Email text input with inline error presentation wired for accessibility.
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      id,
      label,
      value,
      onChange,
      onBlur,
      error,
      description,
      autoComplete,
      disabled,
      className,
    },
    ref,
  ) => {
    const descriptionId = description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    };

    return (
      <div className={cn("space-y-1", className)}>
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
        <input
          ref={ref}
          id={id}
          name={id}
          type="email"
          value={value}
          autoComplete={autoComplete}
          disabled={disabled}
          onChange={handleChange}
          onBlur={onBlur}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={cn(
            "block w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            error && "border-destructive focus-visible:ring-destructive/40",
          )}
        />
        {error ? (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

TextInput.displayName = "TextInput";
