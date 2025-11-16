import { useCallback, useEffect, useRef, useState } from "react";

import type { UserSettingsDto } from "@/types";
import type { SettingsSummaryVM } from "@/lib/viewModels/wizardSimulation";
import type { ApiErrorShape } from "@/lib/viewModels/loans";
import type { ApiFetchMeta } from "./useApiFetch";
import { useApiFetch } from "./useApiFetch";

interface UseUserSettingsOptions {
  readonly enabled?: boolean;
  readonly skipCache?: boolean;
}

interface UseUserSettingsResult {
  readonly settings: SettingsSummaryVM | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorShape | null;
  readonly meta: ApiFetchMeta | null;
  readonly refetch: (options?: { force?: boolean }) => Promise<void>;
}

interface CachedSettingsState {
  value: UserSettingsDto | null;
  meta: ApiFetchMeta | null;
}

const CACHE_KEY = "default";
const cacheStore = new Map<string, CachedSettingsState>();

const mapToViewModel = (
  settings: UserSettingsDto | null,
): SettingsSummaryVM | null => {
  if (!settings) {
    return null;
  }

  return {
    overpaymentLimit: settings.monthlyOverpaymentLimit,
    reinvestReducedPayments: settings.reinvestReducedPayments,
  } satisfies SettingsSummaryVM;
};

/**
 * Loads the current user's settings with lightweight memoized caching between hook invocations.
 */
export function useUserSettings(
  options: UseUserSettingsOptions = {},
): UseUserSettingsResult {
  const { enabled = true, skipCache = false } = options;
  const { apiFetch } = useApiFetch();
  const isMountedRef = useRef(true);

  const cachedSnapshot = skipCache ? null : cacheStore.get(CACHE_KEY);

  const [settings, setSettings] = useState<UserSettingsDto | null>(
    cachedSnapshot?.value ?? null,
  );
  const [meta, setMeta] = useState<ApiFetchMeta | null>(
    cachedSnapshot?.meta ?? null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(!settings && enabled);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runFetch = useCallback(
    async (force = false) => {
      if (!enabled) {
        return;
      }

      if (!force && !skipCache) {
        const cached = cacheStore.get(CACHE_KEY);
        if (cached?.value) {
          setSettings(cached.value);
          setMeta(cached.meta ?? null);
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      const result = await apiFetch<UserSettingsDto>({
        path: "/api/user-settings",
        method: "GET",
      });

      if (!isMountedRef.current) {
        return;
      }

      if (!result.ok) {
        setIsLoading(false);
        setError(result.error);
        return;
      }

      const payload = result.data ?? null;
      const nextMeta = result.meta ?? null;

      cacheStore.set(CACHE_KEY, {
        value: payload,
        meta: nextMeta,
      });

      setSettings(payload);
      setMeta(nextMeta);
      setIsLoading(false);
      setError(null);
    },
    [apiFetch, enabled, skipCache],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void runFetch(Boolean(skipCache));
  }, [enabled, runFetch, skipCache]);

  const refetch = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? true;
      await runFetch(force);
    },
    [runFetch],
  );

  return {
    settings: mapToViewModel(settings),
    isLoading,
    error,
    meta,
    refetch,
  } as const;
}
