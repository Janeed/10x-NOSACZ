import type { APIRoute } from "astro";

import { unauthorizedError, validationError } from "../../../lib/errors.ts";
import {
  errorResponse,
  jsonResponse,
} from "../../../lib/http/responses.ts";
import { logger } from "../../../lib/logger.ts";
import {
  patchLog,
} from "../../../lib/services/monthlyExecutionLogService.ts";
import {
  patchMonthlyExecutionLogSchema,
} from "../../../lib/validation/monthlyExecutionLog.ts";

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

export const PATCH: APIRoute = async ({ locals, request, params }) => {
  const requestId = resolveRequestId(locals.requestId, request);

  try {
    const userId = locals.userId;
    if (!userId) {
      throw unauthorizedError("ERR_UNAUTHORIZED", "Authentication required");
    }

    const logId = params.logId;
    if (!logId) {
      throw validationError("ERR_VALIDATION", "Log ID is required");
    }

    const body = await request.json();
    const cmd = patchMonthlyExecutionLogSchema.parse(body);

    const result = await patchLog(logId, cmd, locals.supabase, userId, requestId || "");

    const headers = new Headers();
    if (requestId) {
      headers.set("X-Request-Id", requestId);
    }

    return jsonResponse(result, { headers });
  } catch (error) {
    logger.error("monthly_execution_logs_patch", "Failed to patch monthly execution log", {
      userId: locals.userId,
      logId: params.logId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error, requestId);
  }
};