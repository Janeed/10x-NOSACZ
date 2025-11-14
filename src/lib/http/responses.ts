import {
  ApiError,
  internalError,
  unauthorizedError,
  isApiError,
} from "../errors.ts";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export const jsonResponse = <T>(body: T, init?: ResponseInit): Response => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", JSON_CONTENT_TYPE);
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
};

export const toApiError = (error: unknown): ApiError => {
  if (isApiError(error)) {
    return error;
  }

  return internalError("INTERNAL_ERROR", "Internal server error", {
    cause: error,
  });
};

export const errorResponse = (error: unknown, requestId?: string): Response => {
  const apiError = toApiError(error);
  const headers = new Headers({ "Content-Type": JSON_CONTENT_TYPE });
  if (requestId) {
    headers.set("X-Request-Id", requestId);
  }

  return new Response(
    JSON.stringify({
      error: {
        code: apiError.code,
        message: apiError.message,
      },
      ...(requestId ? { requestId } : {}),
    }),
    {
      status: apiError.status,
      headers,
    },
  );
};

export const ok = <T>(
  data: T,
  requestId?: string,
  headers?: Record<string, string>,
): Response => {
  const h = new Headers({ "Content-Type": JSON_CONTENT_TYPE });
  if (requestId) {
    h.set("X-Request-Id", requestId);
  }
  if (headers) {
    Object.entries(headers).forEach(([k, v]) => h.set(k, v));
  }
  return new Response(JSON.stringify(data), { status: 200, headers: h });
};

export const unauthorized = (message: string, requestId?: string): Response => {
  const error = unauthorizedError("UNAUTHORIZED", message);
  return errorResponse(error, requestId);
};

export const internalErrorResponse = (
  message: string,
  requestId?: string,
  cause?: unknown,
): Response => {
  const error = internalError("INTERNAL_ERROR", message, { cause });
  return errorResponse(error, requestId);
};
