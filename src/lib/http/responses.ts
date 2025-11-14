import { ApiError, internalError, isApiError } from '../errors.ts';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

export const jsonResponse = <T>(body: T, init?: ResponseInit): Response => {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', JSON_CONTENT_TYPE);
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

  return internalError('INTERNAL_ERROR', 'Internal server error', { cause: error });
};

export const errorResponse = (error: unknown, requestId?: string): Response => {
  const apiError = toApiError(error);
  const headers = new Headers({ 'Content-Type': JSON_CONTENT_TYPE });
  if (requestId) {
    headers.set('X-Request-Id', requestId);
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
