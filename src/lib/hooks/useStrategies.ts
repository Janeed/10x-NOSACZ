import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StrategyDto } from "@/types";
import { useApiFetch } from "./useApiFetch";
import type { StrategyOptionVM } from "@/lib/viewModels/wizardSimulation";
import type { ApiErrorShape } from "@/lib/viewModels/loans";

interface UseStrategiesOptions {
  readonly selectedStrategyId?: string;
  readonly enabled?: boolean;
}

interface UseStrategiesResult {
  readonly strategies: StrategyOptionVM[];
  readonly isLoading: boolean;
  readonly error: ApiErrorShape | null;
  readonly refetch: () => Promise<void>;
  readonly hasLoaded: boolean;
}

const mapToViewModel = (
  strategies: StrategyDto[],
  selectedStrategyId: string | undefined,
): StrategyOptionVM[] => {
  return strategies.map((strategy) => {
    return {
      ...strategy,
      selected: strategy.id === selectedStrategyId,
    } satisfies StrategyOptionVM;
  });
};

/**
 * Fetches the strategy catalog for the wizard and maps it to selection-ready view models.
 */
export function useStrategies(
  options: UseStrategiesOptions = {},
): UseStrategiesResult {
  const { selectedStrategyId, enabled = true } = options;
  const { apiFetch } = useApiFetch();

  const isMountedRef = useRef(true);
  const [rawStrategies, setRawStrategies] = useState<StrategyDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runFetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await apiFetch<StrategyDto[]>({
      path: "/api/strategies",
      method: "GET",
    });

    if (!isMountedRef.current) {
      return;
    }

    setHasLoaded(true);

    if (!result.ok) {
      setIsLoading(false);
      setError(result.error);
      return;
    }

    const payload = result.data ?? [];
    setRawStrategies(payload);
    setIsLoading(false);
    setError(null);
  }, [apiFetch, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void runFetch();
  }, [enabled, runFetch]);

  const strategies = useMemo(() => {
    return mapToViewModel(rawStrategies, selectedStrategyId);
  }, [rawStrategies, selectedStrategyId]);

  const refetch = useCallback(async () => {
    await runFetch();
  }, [runFetch]);

  return {
    strategies,
    isLoading,
    error,
    refetch,
    hasLoaded,
  } as const;
}
