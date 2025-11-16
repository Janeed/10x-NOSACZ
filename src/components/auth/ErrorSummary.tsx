import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ErrorItem {
  readonly id?: string;
  readonly message: string;
}

interface ErrorSummaryProps {
  readonly errors: ErrorItem[];
  readonly className?: string;
  readonly supportDetails?: {
    summary: string;
    content: string;
  };
}

const ERROR_TITLE_ID = "auth-error-summary-title";

/**
 * Renders a focusable alert region to surface server or global form errors.
 */
export function ErrorSummary({
  errors,
  className,
  supportDetails,
}: ErrorSummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasErrors = errors.length > 0;

  useEffect(() => {
    if (!hasErrors) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    node.focus({ preventScroll: false });
  }, [hasErrors, errors]);

  if (!hasErrors) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      role="alert"
      aria-live="assertive"
      aria-labelledby={ERROR_TITLE_ID}
      tabIndex={-1}
      data-test="error-summary"
      className={cn(
        "rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/40",
        className,
      )}
    >
      <p id={ERROR_TITLE_ID} className="font-medium">
        Please review the highlighted issues
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error) => (
          <li key={error.id ?? error.message}>{error.message}</li>
        ))}
      </ul>
      {supportDetails ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {supportDetails.summary}
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">
            {supportDetails.content}
          </p>
        </details>
      ) : null}
    </div>
  );
}
