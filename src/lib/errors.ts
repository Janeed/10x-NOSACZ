export type ApiErrorOptions = {
  details?: unknown;
  cause?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, options?: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options?.details;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

const createApiError = (
  status: number,
  code: string,
  message: string,
  options?: ApiErrorOptions,
): ApiError => {
  return new ApiError(status, code, message, options);
};

export const validationError = (code: string, message: string, details?: unknown): ApiError => {
  return createApiError(400, code, message, { details });
};

export const unauthorizedError = (code: string, message: string, details?: unknown): ApiError => {
  return createApiError(401, code, message, { details });
};

export const notFoundError = (code: string, message: string, details?: unknown): ApiError => {
  return createApiError(404, code, message, { details });
};

export const conflictError = (code: string, message: string, details?: unknown): ApiError => {
  return createApiError(409, code, message, { details });
};

export const tooManyRequestsError = (code: string, message: string, details?: unknown): ApiError => {
  return createApiError(429, code, message, { details });
};

export const internalError = (code: string, message: string, options?: ApiErrorOptions): ApiError => {
  return createApiError(500, code, message, options);
};

export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError;
};
