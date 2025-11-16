import { useCallback } from "react";

export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

const STORAGE_KEY = "nosacz.auth.session";

const readSession = (): SessionTokens | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SessionTokens;
    if (parsed && typeof parsed.accessToken === "string" && typeof parsed.refreshToken === "string") {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse session storage entry", error);
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
  return null;
};

const writeSession = (tokens: SessionTokens) => {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
};

const dropSession = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEY);
};

/**
 * Encapsulates session token persistence backed by sessionStorage.
 */
export function useSession() {
  const getSession = useCallback(() => {
    return readSession();
  }, []);

  const saveSession = useCallback((tokens: SessionTokens) => {
    writeSession(tokens);
  }, []);

  const clearSession = useCallback(() => {
    dropSession();
  }, []);

  const getAccessToken = useCallback(() => {
    const session = readSession();
    return session?.accessToken ?? null;
  }, []);

  return {
    getSession,
    saveSession,
    clearSession,
    getAccessToken,
  } as const;
}
