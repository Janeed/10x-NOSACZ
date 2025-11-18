import { useCallback, useRef, useState } from "react";

import type { UpdateUserSettingsCommand, UserSettingsDto } from "@/types";
import type { ApiErrorShape } from "@/lib/viewModels/loans";
import { useApiFetch } from "./useApiFetch";

export interface SaveResult {
  readonly dto: UserSettingsDto;
  readonly created: boolean;
  readonly eTag?: string | null;
}

export interface UseSaveUserSettingsOptions {
  readonly isInitialized: boolean;
  readonly eTag?: string | null;
}

export interface UseSaveUserSettings {
  readonly save: (
    command: UpdateUserSettingsCommand,
  ) => Promise<SaveResult | null>;
  readonly isSaving: boolean;
  readonly error: ApiErrorShape | null;
  readonly lastResult?: SaveResult | null;
  readonly clearError: () => void;
}

export function useSaveUserSettings(
  options: UseSaveUserSettingsOptions,
): UseSaveUserSettings {
  const { isInitialized, eTag } = options;
  const { apiFetch } = useApiFetch();
  const mountedRef = useRef(true);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [lastResult, setLastResult] = useState<SaveResult | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const save = useCallback(
    async (command: UpdateUserSettingsCommand): Promise<SaveResult | null> => {
      setIsSaving(true);
      setError(null);
      setLastResult(null);
      const headers: HeadersInit = {};
      if (isInitialized && eTag) {
        headers["If-Match"] = eTag;
      }

      const result = await apiFetch<UserSettingsDto, UpdateUserSettingsCommand>(
        {
          path: "/api/user-settings",
          method: "PUT",
          body: command,
          headers,
        },
      );

      if (!mountedRef.current) {
        return null;
      }

      setIsSaving(false);

      if (!result.ok || !result.data) {
        setError(result.ok ? null : result.error);
        return null;
      }

      const payload: SaveResult = {
        dto: result.data,
        created: result.status === 201,
        eTag: result.meta?.etag ?? null,
      };
      setLastResult(payload);
      return payload;
    },
    [apiFetch, eTag, isInitialized],
  );

  return {
    save,
    isSaving,
    error,
    lastResult,
    clearError,
  } as const;
}
