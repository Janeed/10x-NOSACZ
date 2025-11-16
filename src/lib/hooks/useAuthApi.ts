import { useCallback } from "react";
import type {
  AuthSigninRequest,
  AuthSigninResponse,
  AuthSignupRequest,
  AuthSignupResponse,
} from "@/types";
import type { SessionTokens } from "./useSession";

export interface AuthApiError {
  readonly code: string;
  readonly message: string;
  readonly requestId?: string;
  readonly status: number;
}

interface AuthApiSuccess {
  readonly user: AuthSigninResponse["user"];
  readonly session: SessionTokens;
}

interface AuthApiResult {
  readonly success: true;
  readonly data: AuthApiSuccess;
}

interface AuthApiErrorResult {
  readonly success: false;
  readonly error: AuthApiError;
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const parseJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const toSessionTokens = (payload: AuthSigninResponse): SessionTokens => {
  return {
    accessToken: payload.session.accessToken,
    refreshToken: payload.session.refreshToken,
  };
};

const buildError = async (response: Response): Promise<AuthApiError> => {
  const body = await parseJson<{
    error?: { code?: string; message?: string };
    requestId?: string;
  }>(response);
  const fallbackMessage =
    response.status >= 500
      ? "Something went wrong. Please try again."
      : "Unable to complete request.";

  return {
    code: body?.error?.code ?? "UNKNOWN_ERROR",
    message: body?.error?.message ?? fallbackMessage,
    requestId:
      body?.requestId ?? response.headers.get("X-Request-Id") ?? undefined,
    status: response.status,
  };
};

const post = async <Req, Res>(
  endpoint: string,
  payload: Req,
): Promise<AuthApiResult | AuthApiErrorResult> => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const body = (await parseJson<Res>(response)) as Res;
      const authBody = body as AuthSigninResponse;
      return {
        success: true,
        data: {
          user: authBody.user,
          session: toSessionTokens(authBody),
        },
      };
    }

    return {
      success: false,
      error: await buildError(response),
    };
  } catch {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Network error. Please check your connection and try again.",
        requestId: undefined,
        status: 0,
      },
    };
  }
};

/**
 * Provides authenticated API interactions for signin and signup flows.
 */
export function useAuthApi() {
  const signin = useCallback(async (payload: AuthSigninRequest) => {
    return post<AuthSigninRequest, AuthSigninResponse>(
      "/api/auth/signin",
      payload,
    );
  }, []);

  const signup = useCallback(async (payload: AuthSignupRequest) => {
    return post<AuthSignupRequest, AuthSignupResponse>(
      "/api/auth/signup",
      payload,
    );
  }, []);

  return { signin, signup } as const;
}
