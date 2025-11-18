import type { FC } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  readonly error?: { code?: string; message: string } | null;
  readonly onRetry?: () => void;
  readonly onDismiss?: () => void;
}

export const ErrorAlert: FC<Props> = ({ error, onRetry, onDismiss }) => {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"
    >
      <div className="space-y-1">
        {error.code ? (
          <p className="font-semibold">Error: {error.code}</p>
        ) : (
          <p className="font-semibold">An error occurred</p>
        )}
        <p>{error.message}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {onDismiss ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
};
