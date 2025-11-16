import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  CreateSimulationCommand,
  SimulationCancelResponse,
  SimulationDto,
  SimulationQueuedResponse,
} from "@/types";
import type {
  SimulationPhase,
  SimulationStatusVM,
} from "@/lib/viewModels/wizardSimulation";
import type { ApiErrorShape } from "@/lib/viewModels/loans";
import { useApiFetch } from "./useApiFetch";
import type { GoalType } from "@/types";

const POLL_INTERVAL_INITIAL = 1500;
const POLL_INTERVAL_MAX = 5000;

export interface SimulationSubmitPayload {
  readonly strategyId: string;
  readonly goal: GoalType;
  readonly reinvestReducedPayments: boolean;
  readonly monthlyOverpaymentLimit?: number;
  readonly paymentReductionTarget?: number;
  readonly notes?: string;
}

export type SimulationSubmitResult =
  | { readonly ok: true; readonly simulationId: string }
  | {
      readonly ok: false;
      readonly type: "validation" | "conflict" | "error";
      readonly error: ApiErrorShape;
    };

interface UseSimulationSubmissionResult {
  readonly status: SimulationStatusVM;
  readonly submitting: boolean;
  readonly cancelling: boolean;
  readonly lastError: ApiErrorShape | null;
  readonly submit: (
    payload: SimulationSubmitPayload,
  ) => Promise<SimulationSubmitResult>;
  readonly retry: () => Promise<SimulationSubmitResult>;
  readonly cancel: () => Promise<void>;
  readonly reset: () => void;
}

const INITIAL_STATUS: SimulationStatusVM = {
  phase: "idle",
};

const mapPhaseFromStatus = (
  status: SimulationDto["status"],
): SimulationPhase => {
  const normalized = String(status);
  switch (normalized) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "active":
    case "stale":
      return "completed";
    case "failed":
    case "error":
      return "error";
    default:
      return "error";
  }
};

const queuePhaseFromResponse = (
  status: SimulationQueuedResponse["status"],
): SimulationPhase => {
  const normalized = String(status);
  switch (normalized) {
    case "running":
      return "running";
    case "queued":
      return "queued";
    default:
      return "queued";
  }
};

const DEFAULT_MESSAGES: Record<SimulationPhase, string> = {
  idle: "No simulation in progress. Configure your inputs and start a new run when ready.",
  queued:
    "Simulation queued. We will monitor progress and update this status automatically.",
  running:
    "Simulation is currently running. You can stay on this page while we crunch the numbers.",
  completed:
    "Simulation completed. Review your dashboard for the latest projections.",
  cancelled:
    "Simulation cancelled. Adjust your inputs and submit again if needed.",
  error: "The simulation encountered an error. Try submitting again.",
  conflict:
    "Another simulation is already running. Cancel it or retry once it finishes.",
};

export function useSimulationSubmission(): UseSimulationSubmissionResult {
  const { apiFetch } = useApiFetch();

  const [status, setStatus] = useState<SimulationStatusVM>(INITIAL_STATUS);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [lastError, setLastError] = useState<ApiErrorShape | null>(null);

  const activeSimulationIdRef = useRef<string | undefined>(undefined);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDelayRef = useRef<number>(POLL_INTERVAL_INITIAL);
  const lastPayloadRef = useRef<SimulationSubmitPayload | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollDelayRef.current = POLL_INTERVAL_INITIAL;
  }, []);

  const updateStatus = useCallback(
    (next: Partial<SimulationStatusVM> & { phase: SimulationPhase }) => {
      setStatus((current) => {
        const merged: SimulationStatusVM = {
          phase: next.phase,
          simulationId: next.simulationId ?? current.simulationId,
          startedAt: next.startedAt ?? current.startedAt,
          completedAt: next.completedAt ?? current.completedAt,
          errorCode: next.errorCode ?? current.errorCode,
          message:
            next.message ?? current.message ?? DEFAULT_MESSAGES[next.phase],
        };

        return merged;
      });
    },
    [],
  );

  const pollSimulation = useCallback(async () => {
    const simulationId = activeSimulationIdRef.current;
    if (!simulationId || !isMountedRef.current) {
      return;
    }

    const result = await apiFetch<SimulationDto>({
      path: `/api/simulations/${simulationId}`,
      method: "GET",
    });

    if (!isMountedRef.current) {
      return;
    }

    if (!result.ok) {
      stopPolling();
      setLastError(result.error);
      updateStatus({
        phase: "error",
        simulationId,
        message: result.error.message ?? DEFAULT_MESSAGES.error,
        errorCode: result.error.code,
      });
      return;
    }

    const simulation = result.data;
    if (!simulation) {
      stopPolling();
      updateStatus({
        phase: "error",
        simulationId,
        message: "Unable to read the simulation status. Please try again.",
      });
      return;
    }

    const phase = mapPhaseFromStatus(simulation.status);

    updateStatus({
      phase,
      simulationId,
      startedAt: simulation.startedAt ?? simulation.createdAt ?? undefined,
      completedAt: simulation.completedAt ?? undefined,
      message: DEFAULT_MESSAGES[phase],
    });

    if (phase === "completed" || phase === "cancelled" || phase === "error") {
      stopPolling();
      return;
    }

    pollDelayRef.current = Math.min(
      pollDelayRef.current + 500,
      POLL_INTERVAL_MAX,
    );

    pollTimeoutRef.current = setTimeout(() => {
      void pollSimulation();
    }, pollDelayRef.current);
  }, [apiFetch, stopPolling, updateStatus]);

  const submit = useCallback(
    async (
      payload: SimulationSubmitPayload,
    ): Promise<SimulationSubmitResult> => {
      if (submitting) {
        return {
          ok: false,
          type: "error",
          error: {
            code: "SUBMISSION_IN_PROGRESS",
            message: "A submission is already in progress. Please wait.",
            status: 0,
          },
        } satisfies SimulationSubmitResult;
      }

      setSubmitting(true);
      setLastError(null);
      lastPayloadRef.current = payload;

      const command: CreateSimulationCommand = {
        strategy: payload.strategyId,
        goal: payload.goal,
        reinvestReducedPayments: payload.reinvestReducedPayments,
        monthlyOverpaymentLimit: payload.monthlyOverpaymentLimit,
        paymentReductionTarget: payload.paymentReductionTarget,
        notes: payload.notes,
      };

      const result = await apiFetch<
        SimulationQueuedResponse,
        CreateSimulationCommand
      >({
        path: "/api/simulations",
        method: "POST",
        body: command,
      });

      if (!isMountedRef.current) {
        return {
          ok: false,
          type: "error",
          error: {
            code: "ABORTED",
            message: "Submission cancelled.",
            status: 0,
          },
        };
      }

      setSubmitting(false);

      if (!result.ok) {
        setLastError(result.error);

        if (result.status === 422) {
          updateStatus({
            phase: "error",
            message: result.error.message ?? DEFAULT_MESSAGES.error,
            errorCode: result.error.code,
          });
          return {
            ok: false,
            type: "validation",
            error: result.error,
          } satisfies SimulationSubmitResult;
        }

        if (result.status === 409) {
          updateStatus({
            phase: "conflict",
            message:
              result.error.message ??
              "Another simulation is already running. Cancel it or retry once it finishes.",
            errorCode: result.error.code,
          });
          return {
            ok: false,
            type: "conflict",
            error: result.error,
          } satisfies SimulationSubmitResult;
        }

        updateStatus({
          phase: "error",
          message: result.error.message ?? DEFAULT_MESSAGES.error,
          errorCode: result.error.code,
        });

        return {
          ok: false,
          type: "error",
          error: result.error,
        } satisfies SimulationSubmitResult;
      }

      const data = result.data;
      if (!data) {
        updateStatus({
          phase: "error",
          message: "The server did not return a simulation reference.",
        });
        return {
          ok: false,
          type: "error",
          error: {
            code: "INVALID_RESPONSE",
            message: "Simulation reference missing in response.",
            status: result.status,
          },
        } satisfies SimulationSubmitResult;
      }

      const simulationId = data.simulationId;
      activeSimulationIdRef.current = simulationId;

      const phase = queuePhaseFromResponse(data.status);
      updateStatus({
        phase,
        simulationId,
        startedAt: data.queuedAt,
        message:
          phase === "running"
            ? DEFAULT_MESSAGES.running
            : DEFAULT_MESSAGES.queued,
      });

      stopPolling();
      pollDelayRef.current = POLL_INTERVAL_INITIAL;
      pollTimeoutRef.current = setTimeout(() => {
        void pollSimulation();
      }, pollDelayRef.current);

      return {
        ok: true,
        simulationId,
      } satisfies SimulationSubmitResult;
    },
    [apiFetch, pollSimulation, stopPolling, submitting, updateStatus],
  );

  const retry = useCallback(async (): Promise<SimulationSubmitResult> => {
    if (!lastPayloadRef.current) {
      return {
        ok: false,
        type: "error",
        error: {
          code: "NO_PREVIOUS_SUBMISSION",
          message: "There is no previous submission to retry.",
          status: 0,
        },
      } satisfies SimulationSubmitResult;
    }

    return submit(lastPayloadRef.current);
  }, [submit]);

  const cancel = useCallback(async () => {
    const simulationId = activeSimulationIdRef.current;
    if (!simulationId) {
      return;
    }

    setCancelling(true);
    const result = await apiFetch<SimulationCancelResponse>({
      path: `/api/simulations/${simulationId}/cancel`,
      method: "POST",
    });

    if (!isMountedRef.current) {
      return;
    }

    setCancelling(false);

    if (!result.ok) {
      setLastError(result.error);
      updateStatus({
        phase: "error",
        simulationId,
        message: result.error.message ?? DEFAULT_MESSAGES.error,
        errorCode: result.error.code,
      });
      return;
    }

    stopPolling();
    updateStatus({
      phase: "cancelled",
      simulationId,
      completedAt: new Date().toISOString(),
      message: DEFAULT_MESSAGES.cancelled,
    });
  }, [apiFetch, stopPolling, updateStatus]);

  const reset = useCallback(() => {
    stopPolling();
    activeSimulationIdRef.current = undefined;
    lastPayloadRef.current = null;
    setLastError(null);
    setStatus(INITIAL_STATUS);
  }, [stopPolling]);

  return useMemo(
    () => ({
      status,
      submitting,
      cancelling,
      lastError,
      submit,
      retry,
      cancel,
      reset,
    }),
    [cancel, cancelling, lastError, reset, retry, status, submit, submitting],
  );
}
