import { useCallback, useEffect, useRef, useState } from "react";

import type { UserSettingsDto } from "@/types";
import type { ApiErrorShape } from "@/lib/viewModels/loans";
import type { ApiFetchMeta } from "./useApiFetch";
import { useApiFetch } from "./useApiFetch";

export interface UseSettingsResourceResult {
  readonly dto?: UserSettingsDto;
  readonly eTag?: string | null;
  readonly isInitialized: boolean;
  readonly isLoading: boolean;
  readonly error: ApiErrorShape | null;
  readonly meta: ApiFetchMeta | null;
  readonly refetch: (options?: { force?: boolean }) => Promise<void>;
}

/**
 * Fetches the current user's settings for the Settings view.
 * - 200: returns dto and ETag
 * - 404: treated as uninitialized (no error)
 * - other errors: exposed via `error`
 */
export function useSettingsResource(): UseSettingsResourceResult {
  const { apiFetch } = useApiFetch();
  const isMountedRef = useRef(true);
  const dtoRef = useRef<UserSettingsDto | undefined>(undefined);

  const [dto, setDto] = useState<UserSettingsDto | undefined>(undefined);
  const [meta, setMeta] = useState<ApiFetchMeta | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runFetch = useCallback(
    async (force = true) => {
      if (!force && dtoRef.current !== undefined) {
        return;
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
        if (result.status === 404) {
          dtoRef.current = undefined;
          setDto(undefined);
          setMeta(result.meta ?? null);
          setIsInitialized(false);
          setIsLoading(false);
          setError(null);
          return;
        }

        setIsLoading(false);
        setError(result.error);
        setMeta(result.meta ?? null);
        return;
      }

      const payload = result.data ?? undefined;
      dtoRef.current = payload;
      setDto(payload);
      setMeta(result.meta ?? null);
      setIsInitialized(true);
      setIsLoading(false);
      setError(null);
    },
    [apiFetch],
  );

  useEffect(() => {
    void runFetch(true);
  }, [runFetch]);

  const refetch = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? true;
      await runFetch(force);
    },
    [runFetch],
  );

  return {
    dto,
    eTag: meta?.etag ?? null,
    isInitialized,
    isLoading,
    error,
    meta,
    refetch,
  } as const;
}
