import { useCallback, useMemo, useState } from "react";

import type {
  LoanListItemVM,
  StaleState,
  StaleTrigger,
} from "@/lib/viewModels/loans";
import type { ApiFetchMeta } from "./useApiFetch";

interface UseStaleSimulationResult {
  readonly staleState: StaleState;
  readonly registerStale: (trigger?: StaleTrigger) => void;
  readonly registerFromMeta: (
    meta: ApiFetchMeta | null | undefined,
    trigger?: StaleTrigger,
  ) => void;
  readonly registerFromLoan: (
    loan: Pick<LoanListItemVM, "staleSimulation"> | null | undefined,
    trigger?: StaleTrigger,
  ) => void;
  readonly registerFromLoans: (
    loans: Pick<LoanListItemVM, "staleSimulation">[],
    trigger?: StaleTrigger,
  ) => void;
  readonly dismiss: () => void;
  readonly reset: () => void;
}

const DEFAULT_STATE: StaleState = { isStale: false, trigger: undefined };

const hasStaleFlag = (
  loan: Pick<LoanListItemVM, "staleSimulation"> | null | undefined,
): boolean => {
  return Boolean(loan?.staleSimulation);
};

/**
 * Manages stale simulation state triggered by loan mutations or API responses.
 */
export function useStaleSimulation(): UseStaleSimulationResult {
  const [state, setState] = useState<StaleState>(DEFAULT_STATE);

  const markStale = useCallback((trigger?: StaleTrigger) => {
    setState((current) => {
      if (current.isStale) {
        if (!current.trigger && trigger) {
          return { isStale: true, trigger } satisfies StaleState;
        }
        return current;
      }

      return {
        isStale: true,
        trigger: trigger ?? current.trigger,
      } satisfies StaleState;
    });
  }, []);

  const registerStale = useCallback(
    (trigger?: StaleTrigger) => {
      markStale(trigger);
    },
    [markStale],
  );

  const registerFromMeta = useCallback(
    (meta: ApiFetchMeta | null | undefined, trigger?: StaleTrigger) => {
      if (!meta?.simulationStale) {
        return;
      }
      markStale(trigger);
    },
    [markStale],
  );

  const registerFromLoan = useCallback(
    (
      loan: Pick<LoanListItemVM, "staleSimulation"> | null | undefined,
      trigger?: StaleTrigger,
    ) => {
      if (!hasStaleFlag(loan)) {
        return;
      }
      markStale(trigger);
    },
    [markStale],
  );

  const registerFromLoans = useCallback(
    (
      loans: Pick<LoanListItemVM, "staleSimulation">[],
      trigger?: StaleTrigger,
    ) => {
      if (!Array.isArray(loans)) {
        return;
      }

      const anyStale = loans.some((loan) => hasStaleFlag(loan));
      if (!anyStale) {
        return;
      }

      markStale(trigger);
    },
    [markStale],
  );

  const dismiss = useCallback(() => {
    setState((current) => {
      if (!current.isStale) {
        return current;
      }
      return {
        isStale: false,
        trigger: current.trigger,
      } satisfies StaleState;
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  return useMemo(() => {
    return {
      staleState: state,
      registerStale,
      registerFromMeta,
      registerFromLoan,
      registerFromLoans,
      dismiss,
      reset,
    } as const;
  }, [
    dismiss,
    registerFromLoan,
    registerFromLoans,
    registerFromMeta,
    registerStale,
    reset,
    state,
  ]);
}
