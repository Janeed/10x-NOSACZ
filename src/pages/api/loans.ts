import type { APIRoute } from "astro";

import { unauthorizedError, validationError } from "../../lib/errors.ts";
import {
  errorResponse,
  jsonResponse,
  toApiError,
} from "../../lib/http/responses.ts";
import { logger } from "../../lib/logger.ts";
import { createLoan, listLoans } from "../../lib/services/loanService.ts";
import {
  validateCreateLoan,
  validateListQuery,
} from "../../lib/validation/loan.ts";
import type { LoanValidationIssue } from "../../lib/validation/loan.ts";
import type { CreateLoanCommand, LoanListQuery } from "../../types.ts";

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

const throwLoanValidationError = (
  message: string,
  issues: LoanValidationIssue[] | undefined,
): never => {
  throw validationError("LOAN_VALIDATION_FAILED", message, { issues });
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

const parseListQuery = (request: Request) => {
  const url = new URL(request.url);
  const entries = Array.from(url.searchParams.entries());
  const query: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!(key in query)) {
      query[key] = value;
    }
  }
  return query;
};

export const GET: APIRoute = async ({ locals, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);

  try {
    const userId = ensureAuthenticated(locals.userId);

    const parsedQuery = parseListQuery(request);
    const validatedQuery = validateListQuery(parsedQuery);
    if (!validatedQuery.value) {
      throwLoanValidationError(
        "Invalid loan list query",
        validatedQuery.errors,
      );
    }

    const query = validatedQuery.value as LoanListQuery;
    const result = await listLoans(locals.supabase, userId, query);

    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (requestId) {
      headers["X-Request-Id"] = requestId;
    }

    logger.info("loans.list.success", "Loans listed successfully", {
      requestId,
      userId,
      count: result.items.length,
    });

    return jsonResponse(result, { status: 200, headers });
  } catch (error) {
    const apiError = toApiError(error);
    const logContext: Record<string, unknown> = {
      requestId,
      status: apiError.status,
      code: apiError.code,
    };

    if (locals.userId) {
      logContext.userId = locals.userId;
    }

    if (apiError.status >= 500) {
      logger.error("loans.list.failure", apiError.message, logContext);
    } else {
      logger.warn("loans.list.failure", apiError.message, logContext);
    }

    return errorResponse(apiError, requestId);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);

  try {
    const userId = ensureAuthenticated(locals.userId);

    ensureJsonContentType(request);

    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      throw validationError("INVALID_JSON", "Request body must be valid JSON");
    }

    const validatedPayload = validateCreateLoan(rawPayload);
    if (!validatedPayload.value) {
      throwLoanValidationError("Invalid loan payload", validatedPayload.errors);
    }

    const payload = validatedPayload.value as CreateLoanCommand;
    const result = await createLoan(locals.supabase, userId, payload);

    const headers: Record<string, string> = {
      Location: `/api/loans/${result.loan.id}`,
      "Cache-Control": "no-store",
      ETag: result.etag,
    };
    if (requestId) {
      headers["X-Request-Id"] = requestId;
    }

    if (result.staleSimulation) {
      headers["X-Simulation-Stale"] = "true";
    }

    logger.info("loans.create.success", "Loan created successfully", {
      requestId,
      userId,
      loanId: result.loan.id,
      staleSimulation: result.staleSimulation,
    });

    return jsonResponse(result.loan, { status: 201, headers });
  } catch (error) {
    const apiError = toApiError(error);
    const logContext: Record<string, unknown> = {
      requestId,
      status: apiError.status,
      code: apiError.code,
    };

    if (locals.userId) {
      logContext.userId = locals.userId;
    }

    if (apiError.status >= 500) {
      logger.error("loans.create.failure", apiError.message, logContext);
    } else {
      logger.warn("loans.create.failure", apiError.message, logContext);
    }

    return errorResponse(apiError, requestId);
  }
};
