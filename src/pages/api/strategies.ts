import type { APIRoute } from "astro";
import {
  listStrategies,
  StrategyListSchema,
} from "../../lib/services/strategyService.ts";
import {
  ok,
  unauthorized,
  internalErrorResponse,
} from "../../lib/http/responses.ts";
import { logger } from "../../lib/logger.ts";

export const GET: APIRoute = async ({ locals }) => {
  const { userId, requestId } = locals as {
    userId?: string;
    requestId?: string;
  };

  if (!userId) {
    logger.warn("strategies-get", "Unauthorized access attempt", {
      requestId,
    });
    return unauthorized("Missing or invalid token", requestId);
  }

  try {
    const data = listStrategies();
    // Optional validation
    StrategyListSchema.parse(data);

    logger.info("strategies-get", "Strategies listed successfully", {
      requestId,
      count: data.length,
    });

    return ok(data, requestId, { "Cache-Control": "public, max-age=3600" });
  } catch (err) {
    logger.error("strategies-get", "Unexpected error", {
      requestId,
      error: (err as Error).message,
    });
    return internalErrorResponse("Unexpected server error", requestId, err);
  }
};
