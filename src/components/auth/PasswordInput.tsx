import { forwardRef, useState, type ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly error?: string;
  readonly autoComplete?: "current-password" | "new-password";
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * Password input with a visibility toggle and inline error messaging.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      id,
      label,
      value,
      onChange,
      onBlur,
      error,
      autoComplete,
      disabled,
      className,
    },
    ref,
  ) => {
    const [isRevealed, setIsRevealed] = useState(false);
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = errorId ?? undefined;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    };

    const toggleVisibility = () => {
      setIsRevealed((current) => !current);
    };

    return (
      <div className={cn("space-y-1", className)}>
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            name={id}
            type={isRevealed ? "text" : "password"}
            value={value}
            autoComplete={autoComplete}
            disabled={disabled}
            onChange={handleChange}
            onBlur={onBlur}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={describedBy}
            className={cn(
              "block w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-base text-foreground shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              error && "border-destructive focus-visible:ring-destructive/40",
            )}
          />
          <button
            type="button"
            onClick={toggleVisibility}
            className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-md px-2 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={isRevealed ? "Hide password" : "Show password"}
            aria-pressed={isRevealed}
            disabled={disabled}
          >
            {isRevealed ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {error ? (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
