import type { APIRoute } from "astro";

import { ActiveSimulationNotFoundError } from "../../../lib/errors.ts";
import { errorResponse, jsonResponse } from "../../../lib/http/responses.ts";
import { logger } from "../../../lib/logger.ts";
import { getDashboardOverview } from "../../../lib/services/dashboardService.ts";
import { parseInclude } from "../../../lib/validation/dashboard.ts";

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
      throw new Error("Authentication required");
    }

    // Parse include query parameter
    const url = new URL(request.url);
    const includeParam = url.searchParams.get("include");
    const include = parseInclude(includeParam ?? undefined);

    const dashboardOverview = await getDashboardOverview(
      locals.supabase,
      userId,
      include,
    );

    const successContext: Record<string, unknown> = {
      userId,
      include: include.length > 0 ? include : undefined,
    };
    if (requestId) {
      successContext.requestId = requestId;
    }

    logger.info(
      "dashboard.overview.success",
      "Fetched dashboard overview",
      successContext,
    );

    return jsonResponse(dashboardOverview, {
      status: 200,
      headers: requestId ? { "X-Request-Id": requestId } : undefined,
    });
  } catch (error) {
    const logContext: Record<string, unknown> = {};

    if (requestId) {
      logContext.requestId = requestId;
    }

    if (locals.userId) {
      logContext.userId = locals.userId;
    }

    if (error instanceof ActiveSimulationNotFoundError) {
      logContext.status = 404;
      logContext.code = error.code;
      logger.warn(
        "dashboard.overview.noActiveSimulation",
        error.message,
        logContext,
      );

      return errorResponse(error, requestId);
    }

    // Handle other errors
    const apiError =
      error instanceof Error ? error : new Error("Unknown error");

    logContext.status = 500;
    logContext.code = "INTERNAL_ERROR";
    logger.error("dashboard.overview.error", apiError.message, logContext);

    return errorResponse(apiError, requestId);
  }
};
