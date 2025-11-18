import type { FC } from "react";

interface Props {
  readonly variant: "created" | "updated";
  readonly onDismiss: () => void;
}

export const SuccessToast: FC<Props> = ({ variant, onDismiss }) => {
  const message =
    variant === "created"
      ? "Settings saved. Your defaults have been created."
      : "Settings updated.";
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-start gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-lg">
        <div className="flex-1">
          <p className="font-medium">{message}</p>
          <p className="text-xs text-emerald-800">
            Re-run your simulation to refresh results.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
          aria-label="Dismiss"
        >
          Close
        </button>
      </div>
    </div>
  );
};
