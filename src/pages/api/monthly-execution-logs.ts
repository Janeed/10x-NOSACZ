import type { APIRoute } from "astro";

import { unauthorizedError } from "../../lib/errors.ts";
import { errorResponse, jsonResponse } from "../../lib/http/responses.ts";
import { logger } from "../../lib/logger.ts";
import {
  listLogs,
  createLog,
} from "../../lib/services/monthlyExecutionLogService.ts";
import {
  monthlyExecutionLogQuerySchema,
  createMonthlyExecutionLogSchema,
} from "../../lib/validation/monthlyExecutionLog.ts";

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

export const GET: APIRoute = async ({ locals, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);

  try {
    const userId = locals.userId;
    if (!userId) {
      throw unauthorizedError("ERR_UNAUTHORIZED", "Authentication required");
    }

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const query = monthlyExecutionLogQuerySchema.parse(queryParams);

    const result = await listLogs(query, locals.supabase, userId);

    const headers = new Headers();
    if (requestId) {
      headers.set("X-Request-Id", requestId);
    }

    return jsonResponse(result, { headers });
  } catch (error) {
    logger.error(
      "monthly_execution_logs_get",
      "Failed to get monthly execution logs",
      {
        userId: locals.userId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return errorResponse(error, requestId);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);

  try {
    const userId = locals.userId;
    if (!userId) {
      throw unauthorizedError("ERR_UNAUTHORIZED", "Authentication required");
    }

    const body = await request.json();
    const cmd = createMonthlyExecutionLogSchema.parse(body);

    const result = await createLog(
      cmd,
      locals.supabase,
      userId,
      requestId || "",
    );

    const headers = new Headers();
    if (requestId) {
      headers.set("X-Request-Id", requestId);
    }

    return jsonResponse(result, { status: 201, headers });
  } catch (error) {
    logger.error(
      "monthly_execution_logs_post",
      "Failed to create monthly execution log",
      {
        userId: locals.userId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return errorResponse(error, requestId);
  }
};
