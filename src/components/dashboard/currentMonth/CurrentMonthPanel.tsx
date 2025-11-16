import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/auth/ToastHost";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { useExecutionLogMutations } from "@/lib/hooks/useExecutionLogMutations";
import type { CurrentMonthEntryVM } from "@/types/dashboard";
import { ConfirmSkipDialog } from "./ConfirmSkipDialog";
import { CurrentMonthCard, CurrentMonthRow } from "./CurrentMonthRow";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

const UNDO_TOAST_DURATION = 10_000;

const resolveMonthLabel = (value: string | Date | null | undefined) => {
  if (!value) {
    return "Current month";
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "Current month";
  }
  return monthFormatter.format(parsed);
};

export function CurrentMonthPanel() {
  const { currentMonthEntries, overview, isLoading, error } =
    useDashboardData();
  const {
    markPaymentPaid,
    markOverpaymentExecuted,
    markOverpaymentSkipped,
    undoSkip,
    pendingUndo,
    isMutating,
  } = useExecutionLogMutations();
  const { showToast, dismissToast } = useToast();
  const [confirmSkipTarget, setConfirmSkipTarget] =
    useState<CurrentMonthEntryVM | null>(null);
  const undoToastIdRef = useRef<string | null>(null);

  const monthLabel = useMemo(() => {
    return resolveMonthLabel(overview?.currentMonth?.monthStart);
  }, [overview?.currentMonth?.monthStart]);

  const hasEntries = currentMonthEntries.length > 0;
  const showSkeleton = isLoading && !hasEntries;
  const showEmptyState = !isLoading && !hasEntries && !error;

  const handleActionError = useCallback(
    (errorValue: unknown, fallbackMessage: string) => {
      const description =
        errorValue instanceof Error && errorValue.message
          ? errorValue.message
          : fallbackMessage;
      showToast({
        description,
        variant: "destructive",
        duration: 6000,
      });
    },
    [showToast],
  );

  const notifySuccess = useCallback(
    (message: string) => {
      showToast({
        description: message,
        variant: "success",
        duration: 4000,
      });
    },
    [showToast],
  );

  const handleMarkPaid = useCallback(
    async (entry: CurrentMonthEntryVM) => {
      try {
        await markPaymentPaid(entry.logId);
        notifySuccess(`Marked payment as paid for loan #${entry.loanId}.`);
      } catch (error) {
        handleActionError(error, "Unable to mark payment as paid.");
      }
    },
    [handleActionError, markPaymentPaid, notifySuccess],
  );

  const handleExecuteOverpayment = useCallback(
    async (entry: CurrentMonthEntryVM) => {
      try {
        await markOverpaymentExecuted(
          entry.logId,
          entry.scheduledOverpayment ?? undefined,
        );
        notifySuccess(
          `Recorded overpayment execution for loan #${entry.loanId}.`,
        );
      } catch (error) {
        handleActionError(error, "Unable to execute overpayment.");
      }
    },
    [handleActionError, markOverpaymentExecuted, notifySuccess],
  );

  const requestSkipConfirmation = useCallback((entry: CurrentMonthEntryVM) => {
    setConfirmSkipTarget(entry);
  }, []);

  const handleCancelSkip = useCallback(() => {
    setConfirmSkipTarget(null);
  }, []);

  const handleConfirmSkip = useCallback(async () => {
    if (!confirmSkipTarget) {
      return;
    }
    try {
      await markOverpaymentSkipped(confirmSkipTarget.logId);
      setConfirmSkipTarget(null);
    } catch (error) {
      handleActionError(error, "Unable to skip overpayment.");
    }
  }, [confirmSkipTarget, handleActionError, markOverpaymentSkipped]);

  useEffect(() => {
    return () => {
      if (undoToastIdRef.current) {
        dismissToast(undoToastIdRef.current);
        undoToastIdRef.current = null;
      }
    };
  }, [dismissToast]);

  useEffect(() => {
    if (!pendingUndo) {
      if (undoToastIdRef.current) {
        dismissToast(undoToastIdRef.current);
        undoToastIdRef.current = null;
      }
      return;
    }

    const toastId = `undo-${pendingUndo.updated.logId}`;

    if (undoToastIdRef.current && undoToastIdRef.current !== toastId) {
      dismissToast(undoToastIdRef.current);
      undoToastIdRef.current = null;
    }

    if (undoToastIdRef.current === toastId) {
      return;
    }

    undoToastIdRef.current = showToast({
      id: toastId,
      description: `Skipped overpayment for loan #${pendingUndo.updated.loanId}. Undo within the next few seconds?`,
      duration: UNDO_TOAST_DURATION,
      action: {
        label: "Undo",
        onClick: () => {
          if (undoToastIdRef.current) {
            dismissToast(undoToastIdRef.current);
            undoToastIdRef.current = null;
          }
          undoSkip()
            .then(() => {
              notifySuccess(
                `Restored overpayment for loan #${pendingUndo.updated.loanId}.`,
              );
            })
            .catch((errorValue) => {
              handleActionError(errorValue, "Unable to undo skip.");
            });
        },
      },
    });
  }, [
    dismissToast,
    handleActionError,
    notifySuccess,
    pendingUndo,
    showToast,
    undoSkip,
  ]);

  const totalScheduled = useMemo(() => {
    return currentMonthEntries.reduce(
      (acc, entry) => {
        return {
          payment: acc.payment + entry.scheduledPayment,
          overpayment: acc.overpayment + (entry.scheduledOverpayment ?? 0),
        };
      },
      { payment: 0, overpayment: 0 },
    );
  }, [currentMonthEntries]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {monthLabel}
          </h2>
          {hasEntries ? (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>
                Payments:{" "}
                <span className="font-medium text-foreground">
                  {currencyFormatter.format(totalScheduled.payment)}
                </span>
              </span>
              <span>
                Overpayments:{" "}
                <span className="font-medium text-foreground">
                  {currencyFormatter.format(totalScheduled.overpayment)}
                </span>
              </span>
            </div>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Track the current month&apos;s scheduled payments and overpayments.
          Update statuses as you complete each step.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error.message ??
            "Something went wrong while loading the current month."}
        </div>
      ) : null}

      {showSkeleton ? <CurrentMonthSkeleton /> : null}

      {showEmptyState ? (
        <div className="rounded-lg border border-dashed border-muted/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
          You&apos;re all caught up—no scheduled payments for this month.
        </div>
      ) : null}

      {!showSkeleton && hasEntries ? (
        <div className="hidden overflow-hidden rounded-lg border border-border md:block">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Loan
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Scheduled payment
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Overpayment
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Payment status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Overpayment status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentMonthEntries.map((entry) => (
                <CurrentMonthRow
                  key={entry.logId}
                  entry={entry}
                  disabled={isMutating}
                  onMarkPaid={() => handleMarkPaid(entry)}
                  onExecuteOverpayment={() => handleExecuteOverpayment(entry)}
                  onSkip={() => requestSkipConfirmation(entry)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!showSkeleton && hasEntries ? (
        <div className="grid gap-4 md:hidden">
          {currentMonthEntries.map((entry) => (
            <CurrentMonthCard
              key={entry.logId}
              entry={entry}
              disabled={isMutating}
              onMarkPaid={() => handleMarkPaid(entry)}
              onExecuteOverpayment={() => handleExecuteOverpayment(entry)}
              onSkip={() => requestSkipConfirmation(entry)}
            />
          ))}
        </div>
      ) : null}

      <ConfirmSkipDialog
        open={Boolean(confirmSkipTarget)}
        loanId={confirmSkipTarget?.loanId}
        onConfirm={handleConfirmSkip}
        onCancel={handleCancelSkip}
        isSubmitting={isMutating}
      />
    </section>
  );
}

function CurrentMonthSkeleton() {
  const rows = Array.from({ length: 3 });
  return (
    <div className="space-y-4 animate-pulse">
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <div className="divide-y divide-border">
          {rows.map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 px-4 py-4 text-sm"
            >
              <div className="h-4 w-32 rounded bg-muted/60" />
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="ml-auto h-8 w-28 rounded bg-muted/60" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:hidden">
        {rows.map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <div className="h-4 w-32 rounded bg-muted/60" />
            <div className="h-4 w-24 rounded bg-muted/60" />
            <div className="h-8 w-full rounded bg-muted/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
