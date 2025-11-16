import type { APIRoute } from "astro";

import {
  preconditionError,
  unauthorizedError,
  validationError,
} from "../../../lib/errors.ts";
import {
  errorResponse,
  jsonResponse,
  toApiError,
} from "../../../lib/http/responses.ts";
import { logger } from "../../../lib/logger.ts";
import {
  deleteLoan,
  getLoan,
  patchLoan,
  updateLoan,
} from "../../../lib/services/loanService.ts";
import {
  validatePatchLoan,
  validateUpdateLoan,
} from "../../../lib/validation/loan.ts";
import type {
  LoanDto,
  PatchLoanCommand,
  UpdateLoanCommand,
} from "../../../types.ts";

const resolveRequestId = (
  localsRequestId: string | undefined,
  request: Request,
): string | undefined => {
  if (localsRequestId) {
    return localsRequestId;
  }

  const headerValue = request.headers.get("x-request-id");
  return headerValue ?? undefined;
};

const ensureAuthenticated = (userId: string | undefined): string => {
  if (!userId) {
    throw unauthorizedError("AUTH_REQUIRED", "Authentication required");
  }

  return userId;
};

const ensureJsonContentType = (request: Request): void => {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    throw validationError(
      "INVALID_CONTENT_TYPE",
      "Content-Type must be application/json",
    );
  }
};

const resolveLoanId = (params: Record<string, string | undefined>): string => {
  const loanId = params.loanId;
  if (!loanId) {
    throw validationError("LOAN_ID_REQUIRED", "Loan identifier is required");
  }

  return loanId;
};

const ensureIfMatch = (request: Request): string => {
  const header = request.headers.get("if-match")?.trim();
  if (!header) {
    throw preconditionError(
      "LOAN_ETAG_REQUIRED",
      "If-Match header is required for loan update",
    );
  }
  return header;
};

const ensureDeleteConfirmation = (request: Request): void => {
  const confirmation = request.headers.get("x-client-confirmation")?.trim();
  if (!confirmation) {
    throw validationError(
      "LOAN_DELETE_CONFIRMATION_REQUIRED",
      "X-Client-Confirmation header must be provided",
    );
  }
};

const respondWithLoan = (
  data: LoanDto,
  status: number,
  requestId: string | undefined,
  etag?: string,
  staleSimulation?: boolean,
): Response => {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
  };

  if (requestId) {
    headers["X-Request-Id"] = requestId;
  }

  if (etag) {
    headers["ETag"] = etag;
  }

  if (staleSimulation) {
    headers["X-Simulation-Stale"] = "true";
  }

  return jsonResponse(data, { status, headers });
};

const handleError = (
  error: unknown,
  requestId: string | undefined,
  userId: string | undefined,
  event: string,
  extraContext?: Record<string, unknown>,
): Response => {
  const apiError = toApiError(error);
  const logContext: Record<string, unknown> = {
    status: apiError.status,
    code: apiError.code,
    ...(extraContext ?? {}),
  };

  if (requestId) {
    logContext.requestId = requestId;
  }

  if (userId) {
    logContext.userId = userId;
  }

  if (apiError.status >= 500) {
    logger.error(event, apiError.message, logContext);
  } else if (apiError.status === 404) {
    logger.warn(event, apiError.message, logContext);
  } else {
    logger.warn(event, apiError.message, logContext);
  }

  return errorResponse(apiError, requestId);
};

export const GET: APIRoute = async ({ locals, params, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);
  let loanId: string | undefined;

  try {
    const userId = ensureAuthenticated(locals.userId);
    loanId = resolveLoanId(params);

    const { loan, etag } = await getLoan(locals.supabase, userId, loanId);

    logger.info("loans.get.success", "Loan fetched successfully", {
      requestId,
      userId,
      loanId,
    });

    return respondWithLoan(loan, 200, requestId, etag);
  } catch (error) {
    return handleError(error, requestId, locals.userId, "loans.get.failure", {
      loanId,
    });
  }
};

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);
  let loanId: string | undefined;

  try {
    const userId = ensureAuthenticated(locals.userId);
    loanId = resolveLoanId(params);
    const ifMatch = ensureIfMatch(request);

    ensureJsonContentType(request);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw validationError("INVALID_JSON", "Request body must be valid JSON");
    }

    const validationResult = validateUpdateLoan(payload);
    if (!validationResult.value) {
      throw validationError("LOAN_VALIDATION_FAILED", "Invalid loan payload", {
        issues: validationResult.errors,
      });
    }

    const command = validationResult.value as UpdateLoanCommand;
    const result = await updateLoan(
      locals.supabase,
      userId,
      loanId,
      command,
      ifMatch,
    );

    logger.info("loans.put.success", "Loan updated successfully", {
      requestId,
      userId,
      loanId,
      staleSimulation: result.staleSimulation,
    });

    return respondWithLoan(
      result.loan,
      200,
      requestId,
      result.etag,
      result.staleSimulation,
    );
  } catch (error) {
    return handleError(error, requestId, locals.userId, "loans.put.failure", {
      loanId,
    });
  }
};

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);
  let loanId: string | undefined;

  try {
    const userId = ensureAuthenticated(locals.userId);
    loanId = resolveLoanId(params);
    const ifMatch = request.headers.get("if-match")?.trim();

    ensureJsonContentType(request);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw validationError("INVALID_JSON", "Request body must be valid JSON");
    }

    const { loan: existingLoan } = await getLoan(
      locals.supabase,
      userId,
      loanId,
    );

    const validationResult = validatePatchLoan(payload, existingLoan);
    if (!validationResult.value) {
      throw validationError("LOAN_VALIDATION_FAILED", "Invalid loan payload", {
        issues: validationResult.errors,
      });
    }

    const command = validationResult.value as PatchLoanCommand;
    const result = await patchLoan(
      locals.supabase,
      userId,
      loanId,
      command,
      ifMatch ?? undefined,
    );

    logger.info("loans.patch.success", "Loan patched successfully", {
      requestId,
      userId,
      loanId,
      staleSimulation: result.staleSimulation,
    });

    return respondWithLoan(
      result.loan,
      200,
      requestId,
      result.etag,
      result.staleSimulation,
    );
  } catch (error) {
    return handleError(error, requestId, locals.userId, "loans.patch.failure", {
      loanId,
    });
  }
};

export const DELETE: APIRoute = async ({ locals, params, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);
  let loanId: string | undefined;

  try {
    const userId = ensureAuthenticated(locals.userId);
    loanId = resolveLoanId(params);

    ensureDeleteConfirmation(request);

    const result = await deleteLoan(locals.supabase, userId, loanId);

    const headers = new Headers({ "Cache-Control": "no-store" });
    if (requestId) {
      headers.set("X-Request-Id", requestId);
    }
    if (result.staleSimulation) {
      headers.set("X-Simulation-Stale", "true");
    }

    logger.info("loans.delete.success", "Loan deleted successfully", {
      requestId,
      userId,
      loanId,
      staleSimulation: result.staleSimulation,
    });

    return new Response(null, { status: 204, headers });
  } catch (error) {
    return handleError(
      error,
      requestId,
      locals.userId,
      "loans.delete.failure",
      {
        loanId,
      },
    );
  }
};
