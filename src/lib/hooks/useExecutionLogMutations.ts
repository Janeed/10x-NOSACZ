import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  DASHBOARD_QUERY_KEYS,
  useDashboardContext,
} from "@/components/dashboard/DashboardDataProvider";
import {
  buildExecutionLogId,
  createLoanLookup,
  isSimulationRunning,
  mapCurrentMonthEntryToViewModel,
} from "@/lib/dashboard/mappers";
import type {
  DashboardOverviewCurrentMonthEntry,
  DashboardOverviewDto,
  MonthlyExecutionLogDto,
  PatchMonthlyExecutionLogCommand,
} from "@/types";
import type { CurrentMonthEntryVM, MutationResult } from "@/types/dashboard";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const UNDO_TIMEOUT_MS = 10_000;

interface ApiErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
  readonly requestId?: string;
}

class ExecutionLogMutationError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "ExecutionLogMutationError";
    this.status = status;
    this.requestId = requestId;
  }
}

interface MutationVariables {
  readonly logId: string;
  readonly payload: PatchMonthlyExecutionLogCommand;
  readonly optimisticUpdater: (
    entry: DashboardOverviewCurrentMonthEntry,
  ) => DashboardOverviewCurrentMonthEntry;
  readonly trackUndo?: boolean;
  readonly undoPayload?: PatchMonthlyExecutionLogCommand;
}

interface MutationContext {
  readonly previousOverview: DashboardOverviewDto | null;
  readonly previousEntry?: CurrentMonthEntryVM;
  readonly updatedEntry?: CurrentMonthEntryVM;
  readonly undoPayload?: PatchMonthlyExecutionLogCommand;
}

interface PendingUndoState {
  readonly result: MutationResult;
  readonly undoPayload: PatchMonthlyExecutionLogCommand;
  readonly expiresAt: number;
}

const buildMutationError = async (
  response: Response,
): Promise<ExecutionLogMutationError> => {
  let requestId: string | undefined;
  let message = "Unable to update execution log.";

  try {
    const body = (await response.json()) as ApiErrorBody;
    requestId =
      body.requestId ?? response.headers.get("X-Request-Id") ?? undefined;
    if (body.error?.message) {
      message = body.error.message;
    }
  } catch {
    requestId = response.headers.get("X-Request-Id") ?? undefined;
  }

  if (response.status === 409) {
    message = "The log was updated elsewhere. Refreshing data.";
  } else if (response.status === 401) {
    message = "You are not authorized to update this log.";
  } else if (response.status >= 500) {
    message = "Server error while updating log.";
  }

  return new ExecutionLogMutationError(message, response.status, requestId);
};

const patchMonthlyExecutionLog = async (
  logId: string,
  payload: PatchMonthlyExecutionLogCommand,
): Promise<MonthlyExecutionLogDto | null> => {
  const response = await fetch(`/api/monthly-execution-logs/${logId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildMutationError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as MonthlyExecutionLogDto;
};

const selectEntryIndex = (
  overview: DashboardOverviewDto,
  logId: string,
): number => {
  if (!overview.currentMonth) {
    return -1;
  }

  const monthStart = String(overview.currentMonth.monthStart);
  return overview.currentMonth.entries.findIndex((entry) => {
    const resolvedId = buildExecutionLogId(
      monthStart,
      entry.loanId,
      entry.logId,
    );
    return resolvedId === logId;
  });
};

const PAYMENT_STATUS_PAID =
  "paid" satisfies PatchMonthlyExecutionLogCommand["paymentStatus"];
const applyOptimisticUpdate = (
  overview: DashboardOverviewDto,
  index: number,
  updater: MutationVariables["optimisticUpdater"],
): {
  nextOverview: DashboardOverviewDto;
  previousEntry: DashboardOverviewCurrentMonthEntry;
  updatedEntry: DashboardOverviewCurrentMonthEntry;
} => {
  if (!overview.currentMonth) {
    return {
      nextOverview: overview,
      previousEntry: {} as DashboardOverviewCurrentMonthEntry,
      updatedEntry: {} as DashboardOverviewCurrentMonthEntry,
    };
  }

  const previousEntry = overview.currentMonth.entries[index];
  const updatedEntry = updater(previousEntry);
  const nextEntries = overview.currentMonth.entries.with(index, updatedEntry);

  return {
    nextOverview: {
      ...overview,
      currentMonth: {
        ...overview.currentMonth,
        entries: nextEntries,
      },
    },
    previousEntry,
    updatedEntry,
  };
};

const cloneCurrentMonthEntry = (
  entry: DashboardOverviewCurrentMonthEntry,
  overrides: Partial<
    Pick<
      DashboardOverviewCurrentMonthEntry,
      | "paymentStatus"
      | "overpaymentStatus"
      | "scheduledPayment"
      | "scheduledOverpayment"
    >
  > = {},
): DashboardOverviewCurrentMonthEntry => {
  return {
    logId: entry.logId,
    loanId: entry.loanId,
    scheduledPayment: overrides.scheduledPayment ?? entry.scheduledPayment,
    scheduledOverpayment:
      overrides.scheduledOverpayment ?? entry.scheduledOverpayment,
    paymentStatus: overrides.paymentStatus ?? entry.paymentStatus,
    overpaymentStatus: overrides.overpaymentStatus ?? entry.overpaymentStatus,
  };
};

const buildViewModelFromEntry = (
  overview: DashboardOverviewDto,
  entry: DashboardOverviewCurrentMonthEntry,
  activeSimulationStatus: string | undefined,
  activeSimulationStale: boolean,
): CurrentMonthEntryVM => {
  const loanLookup = createLoanLookup(overview);
  const monthStart = overview.currentMonth
    ? String(overview.currentMonth.monthStart)
    : "";
  return mapCurrentMonthEntryToViewModel(entry, {
    overview,
    monthStart,
    isSimulationRunning: isSimulationRunning(activeSimulationStatus),
    isSimulationStale: activeSimulationStale,
    loanLookup,
  });
};

const OVERPAYMENT_EXECUTED_STATUS =
  "executed" as PatchMonthlyExecutionLogCommand["overpaymentStatus"];
const OVERPAYMENT_SKIPPED_STATUS =
  "skipped" as PatchMonthlyExecutionLogCommand["overpaymentStatus"];
const OVERPAYMENT_PENDING_STATUS =
  "pending" as PatchMonthlyExecutionLogCommand["overpaymentStatus"];

export interface ExecutionLogMutations {
  readonly pendingUndo: MutationResult | null;
  readonly isMutating: boolean;
  readonly markPaymentPaid: (logId: string) => Promise<MutationResult | null>;
  readonly markOverpaymentExecuted: (
    logId: string,
    actualAmount?: number,
  ) => Promise<MutationResult | null>;
  readonly markOverpaymentSkipped: (
    logId: string,
  ) => Promise<MutationResult | null>;
  readonly undoSkip: () => Promise<MutationResult | null>;
}

export function useExecutionLogMutations(): ExecutionLogMutations {
  const queryClient = useQueryClient();
  const { activeSimulation } = useDashboardContext();
  const [pendingUndoState, setPendingUndoState] =
    useState<PendingUndoState | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const lastContextRef = useRef<MutationContext | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const scheduleUndoExpiry = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    clearUndoTimer();
    undoTimerRef.current = window.setTimeout(() => {
      setPendingUndoState(null);
      undoTimerRef.current = null;
    }, UNDO_TIMEOUT_MS);
  }, [clearUndoTimer]);

  useEffect(() => {
    return () => {
      clearUndoTimer();
    };
  }, [clearUndoTimer]);

  const mutation = useMutation<
    MonthlyExecutionLogDto | null,
    ExecutionLogMutationError,
    MutationVariables,
    MutationContext
  >({
    mutationFn: async ({ logId, payload }: MutationVariables) => {
      return patchMonthlyExecutionLog(logId, payload);
    },
    onMutate: async (variables: MutationVariables) => {
      await queryClient.cancelQueries({
        queryKey: DASHBOARD_QUERY_KEYS.overview,
      });

      const snapshot =
        queryClient.getQueryData<DashboardOverviewDto | null>(
          DASHBOARD_QUERY_KEYS.overview,
        ) ?? null;

      if (!snapshot || !snapshot.currentMonth) {
        const context: MutationContext = {
          previousOverview: snapshot,
        };
        lastContextRef.current = context;
        return context;
      }

      const entryIndex = selectEntryIndex(snapshot, variables.logId);
      if (entryIndex === -1) {
        const context: MutationContext = {
          previousOverview: snapshot,
        };
        lastContextRef.current = context;
        return context;
      }

      const { nextOverview, previousEntry, updatedEntry } =
        applyOptimisticUpdate(
          snapshot,
          entryIndex,
          variables.optimisticUpdater,
        );

      queryClient.setQueryData(DASHBOARD_QUERY_KEYS.overview, nextOverview);

      const activeStatus = activeSimulation?.status;
      const activeStale = Boolean(activeSimulation?.stale);

      const previousVM = buildViewModelFromEntry(
        snapshot,
        previousEntry,
        activeStatus,
        activeStale,
      );
      const updatedVM = buildViewModelFromEntry(
        nextOverview,
        updatedEntry,
        activeStatus,
        activeStale,
      );

      if (variables.trackUndo && variables.undoPayload) {
        const result: MutationResult = {
          previous: previousVM,
          updated: updatedVM,
          requestId: undefined,
        };
        setPendingUndoState({
          result,
          undoPayload: variables.undoPayload,
          expiresAt: Date.now() + UNDO_TIMEOUT_MS,
        });
        scheduleUndoExpiry();
      } else {
        setPendingUndoState((current) => {
          if (current && current.result.updated.logId === updatedVM.logId) {
            return null;
          }
          return current;
        });
      }

      const context: MutationContext = {
        previousOverview: snapshot,
        previousEntry: previousVM,
        updatedEntry: updatedVM,
        undoPayload: variables.undoPayload,
      };
      lastContextRef.current = context;
      return context;
    },
    onError: (
      error: ExecutionLogMutationError,
      _variables: MutationVariables,
      context?: MutationContext,
    ) => {
      if (context?.previousOverview) {
        queryClient.setQueryData(
          DASHBOARD_QUERY_KEYS.overview,
          context.previousOverview,
        );
      }

      if (context?.updatedEntry) {
        setPendingUndoState((current) => {
          if (
            current &&
            current.result.updated.logId === context.updatedEntry?.logId
          ) {
            return null;
          }
          return current;
        });
      }

      lastContextRef.current = context ?? null;

      if (error.status === 409) {
        queryClient.invalidateQueries({
          queryKey: DASHBOARD_QUERY_KEYS.overview,
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: DASHBOARD_QUERY_KEYS.overview,
      });
      queryClient.invalidateQueries({
        queryKey: DASHBOARD_QUERY_KEYS.activeSimulation,
      });
    },
  });

  const markPaymentPaid = useCallback<ExecutionLogMutations["markPaymentPaid"]>(
    async (logId) => {
      const now = new Date().toISOString();

      try {
        await mutation.mutateAsync({
          logId,
          payload: {
            paymentStatus: PAYMENT_STATUS_PAID,
            paymentExecutedAt: now,
          },
          optimisticUpdater: (entry: DashboardOverviewCurrentMonthEntry) =>
            cloneCurrentMonthEntry(entry, {
              paymentStatus: PAYMENT_STATUS_PAID,
            }),
        });
      } catch (error) {
        lastContextRef.current = null;
        throw error;
      }

      const context = lastContextRef.current;
      lastContextRef.current = null;
      if (!context?.previousEntry || !context.updatedEntry) {
        return null;
      }

      return {
        previous: context.previousEntry,
        updated: context.updatedEntry,
        requestId: undefined,
      } satisfies MutationResult;
    },
    [mutation],
  );

  const markOverpaymentExecuted = useCallback<
    ExecutionLogMutations["markOverpaymentExecuted"]
  >(
    async (logId, actualAmount) => {
      const now = new Date().toISOString();
      try {
        await mutation.mutateAsync({
          logId,
          payload: {
            overpaymentStatus: OVERPAYMENT_EXECUTED_STATUS,
            overpaymentExecutedAt: now,
            actualOverpaymentAmount: actualAmount,
          },
          optimisticUpdater: (entry: DashboardOverviewCurrentMonthEntry) =>
            cloneCurrentMonthEntry(entry, {
              overpaymentStatus: OVERPAYMENT_EXECUTED_STATUS,
            }),
        });
      } catch (error) {
        lastContextRef.current = null;
        throw error;
      }

      const context = lastContextRef.current;
      lastContextRef.current = null;
      if (!context?.previousEntry || !context.updatedEntry) {
        return null;
      }

      return {
        previous: context.previousEntry,
        updated: context.updatedEntry,
        requestId: undefined,
      } satisfies MutationResult;
    },
    [mutation],
  );

  const markOverpaymentSkipped = useCallback<
    ExecutionLogMutations["markOverpaymentSkipped"]
  >(
    async (logId) => {
      try {
        await mutation.mutateAsync({
          logId,
          payload: {
            overpaymentStatus: OVERPAYMENT_SKIPPED_STATUS,
            reasonCode: "USER_SKIPPED",
          },
          optimisticUpdater: (entry: DashboardOverviewCurrentMonthEntry) =>
            cloneCurrentMonthEntry(entry, {
              overpaymentStatus: OVERPAYMENT_SKIPPED_STATUS,
            }),
          trackUndo: true,
          undoPayload: {
            overpaymentStatus: OVERPAYMENT_PENDING_STATUS,
            reasonCode: null,
          },
        });
      } catch (error) {
        lastContextRef.current = null;
        throw error;
      }

      const context = lastContextRef.current;
      lastContextRef.current = null;
      if (!context?.previousEntry || !context.updatedEntry) {
        return null;
      }

      return {
        previous: context.previousEntry,
        updated: context.updatedEntry,
        requestId: undefined,
      } satisfies MutationResult;
    },
    [mutation],
  );

  const undoSkip = useCallback<ExecutionLogMutations["undoSkip"]>(async () => {
    if (!pendingUndoState) {
      return null;
    }

    clearUndoTimer();

    try {
      await mutation.mutateAsync({
        logId: pendingUndoState.result.updated.logId,
        payload: pendingUndoState.undoPayload,
        optimisticUpdater: (entry: DashboardOverviewCurrentMonthEntry) =>
          cloneCurrentMonthEntry(entry, {
            overpaymentStatus: OVERPAYMENT_PENDING_STATUS,
          }),
      });
    } catch (error) {
      lastContextRef.current = null;
      throw error;
    }

    setPendingUndoState(null);

    const context = lastContextRef.current;
    lastContextRef.current = null;
    if (!context?.previousEntry || !context.updatedEntry) {
      return null;
    }

    return {
      previous: context.previousEntry,
      updated: context.updatedEntry,
      requestId: undefined,
    } satisfies MutationResult;
  }, [clearUndoTimer, mutation, pendingUndoState]);

  const pendingUndo = useMemo(
    () => pendingUndoState?.result ?? null,
    [pendingUndoState],
  );

  return {
    pendingUndo,
    isMutating: mutation.isPending,
    markPaymentPaid,
    markOverpaymentExecuted,
    markOverpaymentSkipped,
    undoSkip,
  };
}
