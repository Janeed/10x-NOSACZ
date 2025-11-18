import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { useApiFetch } from "@/lib/hooks/useApiFetch";
import type { ApiFetchMeta } from "@/lib/hooks/useApiFetch";
import type { LoanListItemVM, StaleTrigger } from "@/lib/viewModels/loans";
import type { LoanDto, PatchLoanCommand } from "@/types";

interface LoanBalanceQuickEditProps {
  readonly open: boolean;
  readonly loan?: LoanListItemVM;
  readonly etag?: string;
  readonly onClose: () => void;
  readonly onPatched: (payload: {
    loan: LoanListItemVM;
    etag?: string | null;
    trigger: StaleTrigger;
    meta?: ApiFetchMeta | null;
  }) => void;
}

const formatInput = (value: number | "") => {
  if (value === "") {
    return "";
  }
  return Number.isFinite(value) ? String(value) : "";
};

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 2,
});

export const LoanBalanceQuickEdit = ({
  open,
  loan,
  etag,
  onClose,
  onPatched,
}: LoanBalanceQuickEditProps) => {
  const { apiFetch } = useApiFetch();
  const [balance, setBalance] = useState<number | "">("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [nonFieldError, setNonFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !loan) {
      return;
    }
    setBalance(Number(loan.remainingBalance ?? 0));
    setFieldError(null);
    setNonFieldError(null);
    setIsSubmitting(false);
  }, [loan, open]);

  const title = useMemo(() => {
    return loan
      ? `Adjust ${loan ? loan.id.slice(0, 8) : "loan"} balance`
      : "Adjust balance";
  }, [loan]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === "") {
      setBalance("");
      setFieldError(null);
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) {
      setBalance("");
      setFieldError("Enter a valid amount.");
      return;
    }
    setBalance(parsed);
    setFieldError(null);
  }, []);

  const validate = useCallback(
    (value: number | "") => {
      if (!loan) {
        return "Loan details unavailable.";
      }
      if (value === "") {
        return "Enter a balance.";
      }
      if (value < 0) {
        return "Balance cannot be negative.";
      }
      if (value > loan.principal) {
        return "Balance cannot exceed principal.";
      }
      return null;
    },
    [loan],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!loan || isSubmitting) {
        return;
      }

      const validationError = validate(balance);
      if (validationError) {
        setFieldError(validationError);
        return;
      }

      if (typeof balance !== "number") {
        setFieldError("Enter a balance.");
        return;
      }

      if (balance === loan.remainingBalance) {
        onClose();
        return;
      }

      setIsSubmitting(true);
      setFieldError(null);
      setNonFieldError(null);

      const payload: PatchLoanCommand = {
        remainingBalance: balance,
      };

      const headers: Record<string, string> = {};
      if (etag) {
        headers["If-Match"] = etag;
      }

      const result = await apiFetch<LoanDto, PatchLoanCommand>({
        path: `/api/loans/${loan.id}`,
        method: "PATCH",
        body: payload,
        headers,
      });

      setIsSubmitting(false);

      if (!result.ok || !result.data) {
        const message = result.ok
          ? "Unable to update balance."
          : result.error.message;
        setNonFieldError(message);
        if (!result.ok && result.error.issues) {
          const balanceIssue = result.error.issues.find((issue) => {
            return (
              issue.path === "remainingBalance" ||
              issue.path === "remaining_balance"
            );
          });
          if (balanceIssue) {
            setFieldError(balanceIssue.message);
          }
        }
        return;
      }

      const updatedLoan: LoanListItemVM = {
        ...result.data,
        etag: result.meta?.etag ?? undefined,
      };

      onPatched({
        loan: updatedLoan,
        etag: result.meta?.etag ?? null,
        trigger: "balance_adjust",
        meta: result.meta ?? null,
      });

      onClose();
    },
    [apiFetch, balance, etag, isSubmitting, loan, onClose, onPatched, validate],
  );

  if (!open || !loan) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/50"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Adjust remaining balance"
        className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update the remaining balance after recording an extra payment. This
          change will mark simulations as stale.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="quick-balance-value"
            >
              Remaining balance
            </label>
            <input
              id="quick-balance-value"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              value={formatInput(balance)}
              onChange={handleChange}
            />
            <p className="mt-1 text-xs text-slate-500">
              Principal: {currencyFormatter.format(loan.principal)}
            </p>
            {fieldError ? (
              <p className="mt-1 text-xs text-red-600">{fieldError}</p>
            ) : null}
          </div>

          {nonFieldError ? (
            <p className="text-sm text-red-600">{nonFieldError}</p>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
