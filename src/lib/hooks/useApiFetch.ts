import { useCallback } from "react";

import { useSession } from "./useSession";
import type { ApiErrorShape, ApiErrorIssue } from "@/lib/viewModels/loans";

const JSON_CONTENT_TYPE = "application/json";
const DEFAULT_CREDENTIALS: RequestCredentials = "same-origin";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS";

export interface ApiFetchRequest<TBody = unknown> {
  readonly path: string;
  readonly method?: HttpMethod;
  readonly body?: TBody;
  readonly headers?: HeadersInit;
  readonly signal?: AbortSignal;
  readonly credentials?: RequestCredentials;
  readonly skipJsonEncoding?: boolean;
}

export interface ApiFetchMeta {
  readonly requestId?: string | null;
  readonly etag?: string | null;
  readonly simulationStale?: boolean;
}

export interface ApiFetchSuccess<TResponse> {
  readonly ok: true;
  readonly status: number;
  readonly data: TResponse | null;
  readonly headers: Headers;
  readonly meta: ApiFetchMeta;
  readonly response: Response;
}

export interface ApiFetchFailure {
  readonly ok: false;
  readonly status: number;
  readonly error: ApiErrorShape;
  readonly headers: Headers | null;
  readonly meta: ApiFetchMeta;
  readonly response?: Response;
}

export type ApiFetchResult<TResponse> =
  | ApiFetchSuccess<TResponse>
  | ApiFetchFailure;

const shouldEncodeBody = (body: unknown): boolean => {
  if (body === undefined || body === null) {
    return false;
  }

  if (body instanceof FormData || body instanceof Blob) {
    return false;
  }

  if (typeof body === "string") {
    return false;
  }

  return true;
};

const parseJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const toIssues = (payload: unknown): ApiErrorIssue[] | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const raw = (payload as { issues?: unknown }).issues;
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const collected: ApiErrorIssue[] = [];

  raw.forEach((issue) => {
    if (!issue || typeof issue !== "object") {
      return;
    }

    const cast = issue as {
      path?: string;
      message?: string;
      code?: string;
    };

    if (!cast.message) {
      return;
    }

    collected.push({
      path: cast.path,
      message: cast.message,
      code: cast.code,
    });
  });

  return collected.length > 0 ? collected : undefined;
};

const buildApiError = async (response: Response): Promise<ApiErrorShape> => {
  const parsed = await parseJson<{
    code?: string;
    message?: string;
    error?: { code?: string; message?: string };
    issues?: ApiErrorIssue[];
  }>(response);

  const fallbackMessage =
    response.status >= 500
      ? "Something went wrong. Please try again."
      : "Unable to complete the request.";

  const code = parsed?.code ?? parsed?.error?.code ?? "UNKNOWN_ERROR";
  const message = parsed?.message ?? parsed?.error?.message ?? fallbackMessage;
  const issues = parsed?.issues ?? toIssues(parsed);

  return {
    code,
    message,
    status: response.status,
    ...(issues ? { issues } : {}),
  } satisfies ApiErrorShape;
};

const buildMeta = (headers: Headers): ApiFetchMeta => {
  const requestId = headers.get("X-Request-Id");
  const etag = headers.get("ETag");
  const staleHeader = headers.get("X-Simulation-Stale");

  return {
    requestId,
    etag,
    simulationStale: staleHeader === "true" || staleHeader === "1",
  };
};

const encodeBody = (body: unknown): BodyInit | undefined => {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (body instanceof FormData || body instanceof Blob) {
    return body;
  }

  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
};

/**
 * Standardized HTTP fetch helper that applies auth headers, JSON defaults,
 * and extracts commonly used response metadata.
 */
export function useApiFetch() {
  const { getAccessToken } = useSession();

  const apiFetch = useCallback(
    async <TResponse, TBody = unknown>(
      request: ApiFetchRequest<TBody>,
    ): Promise<ApiFetchResult<TResponse>> => {
      const {
        path,
        method = "GET",
        body,
        headers: customHeaders,
        signal,
        credentials = DEFAULT_CREDENTIALS,
        skipJsonEncoding,
      } = request;

      const headers = new Headers(customHeaders);
      if (!headers.has("Accept")) {
        headers.set("Accept", JSON_CONTENT_TYPE);
      }

      const shouldSetJsonContentType =
        !skipJsonEncoding && shouldEncodeBody(body);

      if (shouldSetJsonContentType && !headers.has("Content-Type")) {
        headers.set("Content-Type", JSON_CONTENT_TYPE);
      }

      const accessToken = getAccessToken();
      if (accessToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }

      const init: RequestInit = {
        method,
        headers,
        credentials,
        signal,
      };

      if (body !== undefined) {
        init.body = skipJsonEncoding ? (body as BodyInit) : encodeBody(body);
      }

      try {
        const response = await fetch(path, init);
        const responseHeaders = response.headers;
        const meta = buildMeta(responseHeaders);

        if (!response.ok) {
          const error = await buildApiError(response);
          return {
            ok: false,
            status: response.status,
            error,
            headers: responseHeaders,
            meta,
            response,
          } satisfies ApiFetchFailure;
        }

        if (response.status === 204 || method === "DELETE") {
          return {
            ok: true,
            status: response.status,
            data: null,
            headers: responseHeaders,
            meta,
            response,
          } satisfies ApiFetchSuccess<TResponse>;
        }

        const data =
          (await parseJson<TResponse>(response)) ?? (null as TResponse | null);

        return {
          ok: true,
          status: response.status,
          data,
          headers: responseHeaders,
          meta,
          response,
        } satisfies ApiFetchSuccess<TResponse>;
      } catch {
        const error: ApiErrorShape = {
          code: "NETWORK_ERROR",
          message: "Network error. Please check your connection.",
          status: 0,
        };

        return {
          ok: false,
          status: 0,
          error,
          headers: null,
          meta: {
            requestId: undefined,
            etag: undefined,
            simulationStale: undefined,
          },
        } satisfies ApiFetchFailure;
      }
    },
    [getAccessToken],
  );

  return { apiFetch } as const;
}
