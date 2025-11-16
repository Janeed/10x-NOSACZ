import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useApiFetch } from "@/lib/hooks/useApiFetch";
import type { ApiFetchMeta } from "@/lib/hooks/useApiFetch";
import type { LoanListItemVM, StaleTrigger } from "@/lib/viewModels/loans";

interface LoanDeleteConfirmProps {
  readonly open: boolean;
  readonly loan?: LoanListItemVM;
  readonly etag?: string;
  readonly onCancel: () => void;
  readonly onDeleted: (payload: {
    id: string;
    trigger: StaleTrigger;
    meta?: ApiFetchMeta | null;
  }) => void;
}

export const LoanDeleteConfirm = ({
  open,
  loan,
  etag,
  onCancel,
  onDeleted,
}: LoanDeleteConfirmProps) => {
  const { apiFetch } = useApiFetch();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const title = useMemo(() => {
    if (!loan) {
      return "Delete loan";
    }
    return `Delete loan ${loan.id.slice(0, 8)}`;
  }, [loan]);

  const handleConfirm = useCallback(async () => {
    if (!loan || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    const headers: Record<string, string> = {
      "X-Client-Confirmation": "confirmed",
    };
    if (etag) {
      headers["If-Match"] = etag;
    }

    const result = await apiFetch({
      path: `/api/loans/${loan.id}`,
      method: "DELETE",
      headers,
    });

    setIsDeleting(false);

    if (!result.ok) {
      setErrorMessage(result.error.message ?? "Unable to delete loan.");
      return;
    }

    onDeleted({
      id: loan.id,
      trigger: "delete",
      meta: result.meta ?? null,
    });
  }, [apiFetch, etag, isDeleting, loan, onDeleted]);

  if (!open || !loan) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/50"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-delete-title"
        className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2
          id="loan-delete-title"
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          This action cannot be undone. Deleting this loan will remove it from
          your dashboard and mark existing simulations as stale.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          Identifier:{" "}
          <span className="font-mono text-slate-900">{loan.id}</span>
        </p>

        {errorMessage ? (
          <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
};
