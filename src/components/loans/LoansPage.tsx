import { useCallback, useEffect, useMemo, useState } from "react";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { LoanBalanceQuickEdit } from "@/components/loans/LoanBalanceQuickEdit";
import { LoanDeleteConfirm } from "@/components/loans/LoanDeleteConfirm";
import { LoansEmptyState } from "@/components/loans/LoansEmptyState";
import { LoansHeader } from "@/components/loans/LoansHeader";
import { LoansList } from "@/components/loans/LoansList";
import { LoanEditorSidebar } from "@/components/loans/LoanEditorSidebar";
import { PaginationControls } from "@/components/loans/PaginationControls";
import { useLoansData } from "@/lib/hooks/useLoansData";
import { useStaleSimulation } from "@/lib/hooks/useStaleSimulation";
import type {
  LoanListItemVM,
  LoanSortField,
  StaleTrigger,
} from "@/lib/viewModels/loans";

const STALE_TRIGGER_LABELS: Record<StaleTrigger, string> = {
  create: "a newly created loan",
  edit: "a loan update",
  delete: "a deleted loan",
  balance_adjust: "a balance adjustment",
  rate_change: "an interest rate change",
};

export const LoansPage: FC = () => {
  const {
    loans,
    isLoading,
    error,
    pagination,
    sorting,
    listMeta,
    changePage,
    changePageSize,
    changeSorting,
    refetch,
    getLoanEtag,
    setLoanEtag,
    upsertLoan,
    removeLoan,
  } = useLoansData();

  const {
    staleState,
    registerStale,
    registerFromMeta,
    registerFromLoans,
    registerFromLoan,
    dismiss,
  } = useStaleSimulation();

  const [editorState, setEditorState] = useState<{
    readonly open: boolean;
    readonly mode: "create" | "edit";
    readonly loan?: LoanListItemVM;
    readonly etag?: string;
  }>({
    open: false,
    mode: "create",
  });

  const [balanceEditState, setBalanceEditState] = useState<{
    readonly open: boolean;
    readonly loan?: LoanListItemVM;
    readonly etag?: string;
  }>({ open: false });

  const [deleteState, setDeleteState] = useState<{
    readonly open: boolean;
    readonly loan?: LoanListItemVM;
    readonly etag?: string;
  }>({ open: false });

  useEffect(() => {
    registerFromMeta(listMeta);
  }, [listMeta, registerFromMeta]);

  useEffect(() => {
    registerFromLoans(loans);
  }, [loans, registerFromLoans]);

  const showEmptyState = useMemo(() => {
    return !isLoading && !error && loans.length === 0;
  }, [error, isLoading, loans.length]);

  const triggerLabel = useMemo(() => {
    if (!staleState.trigger) {
      return null;
    }
    return STALE_TRIGGER_LABELS[staleState.trigger] ?? null;
  }, [staleState.trigger]);

  const handleAddLoan = useCallback(() => {
    setEditorState({ open: true, mode: "create" });
  }, []);

  const handleEditLoan = useCallback(
    (id: string) => {
      const targetLoan = loans.find((item) => item.id === id);
      if (!targetLoan) {
        void refetch();
        return;
      }

      setEditorState({
        open: true,
        mode: "edit",
        loan: targetLoan,
        etag: getLoanEtag(id),
      });
    },
    [getLoanEtag, loans, refetch],
  );

  const handleDeleteLoan = useCallback(
    (id: string) => {
      const targetLoan = loans.find((item) => item.id === id);
      if (!targetLoan) {
        void refetch();
        return;
      }

      setDeleteState({
        open: true,
        loan: targetLoan,
        etag: getLoanEtag(id),
      });
    },
    [getLoanEtag, loans, refetch],
  );

  const handleQuickBalance = useCallback(
    (id: string) => {
      const targetLoan = loans.find((item) => item.id === id);
      if (!targetLoan) {
        void refetch();
        return;
      }

      setBalanceEditState({
        open: true,
        loan: targetLoan,
        etag: getLoanEtag(id),
      });
    },
    [getLoanEtag, loans, refetch],
  );

  const handleCloseEditor = useCallback(() => {
    setEditorState((current) => ({ ...current, open: false }));
  }, []);

  const handleLoanSaved = useCallback(
    (payload: {
      loan: LoanListItemVM;
      etag?: string | null;
      trigger: StaleTrigger;
      meta?: Parameters<typeof registerFromMeta>[0];
    }) => {
      upsertLoan(payload.loan, { etag: payload.etag ?? undefined });
      if (payload.etag) {
        setLoanEtag(payload.loan.id, payload.etag);
      } else {
        setLoanEtag(payload.loan.id, undefined);
      }
      registerFromLoan(payload.loan, payload.trigger);
      registerFromMeta(payload.meta ?? null, payload.trigger);
      registerStale(payload.trigger);
      setEditorState((current) => ({ ...current, open: false }));
    },
    [
      registerFromLoan,
      registerFromMeta,
      registerStale,
      setLoanEtag,
      upsertLoan,
    ],
  );

  const handleCloseBalanceEditor = useCallback(() => {
    setBalanceEditState((current) => ({ ...current, open: false }));
  }, []);

  const handleBalancePatched = useCallback(
    (payload: {
      loan: LoanListItemVM;
      etag?: string | null;
      trigger: StaleTrigger;
      meta?: Parameters<typeof registerFromMeta>[0];
    }) => {
      upsertLoan(payload.loan, { etag: payload.etag ?? undefined });
      if (payload.etag) {
        setLoanEtag(payload.loan.id, payload.etag);
      } else {
        setLoanEtag(payload.loan.id, undefined);
      }
      registerFromLoan(payload.loan, payload.trigger);
      registerFromMeta(payload.meta ?? null, payload.trigger);
      registerStale(payload.trigger);
      setBalanceEditState((current) => ({ ...current, open: false }));
    },
    [
      registerFromLoan,
      registerFromMeta,
      registerStale,
      setLoanEtag,
      upsertLoan,
    ],
  );

  const handleCancelDelete = useCallback(() => {
    setDeleteState((current) => ({ ...current, open: false }));
  }, []);

  const handleLoanDeleted = useCallback(
    (payload: {
      id: string;
      trigger: StaleTrigger;
      meta?: Parameters<typeof registerFromMeta>[0];
    }) => {
      removeLoan(payload.id);
      setLoanEtag(payload.id, undefined);
      registerFromMeta(payload.meta ?? null, payload.trigger);
      registerStale(payload.trigger);
      setDeleteState((current) => ({ ...current, open: false }));
    },
    [registerFromMeta, registerStale, removeLoan, setLoanEtag],
  );

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleSortFieldChange = useCallback(
    (field: LoanSortField) => {
      changeSorting(field);
    },
    [changeSorting],
  );

  const handleToggleSortOrder = useCallback(() => {
    changeSorting(sorting.field);
  }, [changeSorting, sorting.field]);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 py-6">
      {staleState.isStale ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium">Simulation results may be outdated.</p>
              {triggerLabel ? (
                <p className="text-xs text-amber-800">
                  Triggered by {triggerLabel}. Re-run your simulation to refresh
                  insights.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="link"
              className="px-0"
              onClick={dismiss}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <LoansHeader
        sorting={sorting}
        onAdd={handleAddLoan}
        onChangeSortField={handleSortFieldChange}
        onToggleSortOrder={handleToggleSortOrder}
        isAddDisabled={isLoading}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-slate-600">Loading loans…</p>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-red-600">
              Unable to load loans.
            </p>
            <p className="text-sm text-red-500">{error.message}</p>
            <Button type="button" variant="outline" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        ) : showEmptyState ? (
          <LoansEmptyState onAdd={handleAddLoan} isAddDisabled={isLoading} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <p>
                Showing{" "}
                <span className="font-semibold text-slate-900">
                  {loans.length}
                </span>{" "}
                loans · Page {pagination.page} of{" "}
                {Math.max(pagination.totalPages, 1)}
              </p>
              <p>{pagination.totalItems} total loans tracked</p>
            </div>
            <LoansList
              loans={loans}
              sorting={sorting}
              onSort={changeSorting}
              onEdit={handleEditLoan}
              onDelete={handleDeleteLoan}
              onQuickBalance={handleQuickBalance}
            />
            <PaginationControls
              pagination={pagination}
              onChangePage={changePage}
              onChangePageSize={changePageSize}
              isDisabled={isLoading}
            />
          </div>
        )}
      </section>

      <LoanEditorSidebar
        open={editorState.open}
        mode={editorState.mode}
        loan={editorState.loan}
        etag={editorState.etag}
        onClose={handleCloseEditor}
        onSaved={handleLoanSaved}
      />

      <LoanBalanceQuickEdit
        open={balanceEditState.open}
        loan={balanceEditState.loan}
        etag={balanceEditState.etag}
        onClose={handleCloseBalanceEditor}
        onPatched={handleBalancePatched}
      />

      <LoanDeleteConfirm
        open={deleteState.open}
        loan={deleteState.loan}
        etag={deleteState.etag}
        onCancel={handleCancelDelete}
        onDeleted={handleLoanDeleted}
      />
    </section>
  );
};
