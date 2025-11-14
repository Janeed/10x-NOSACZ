import type { APIRoute } from "astro";
import {
  listStrategies,
  StrategyListSchema,
} from "../../lib/services/strategyService";
import {
  ok,
  unauthorized,
  internalErrorResponse,
} from "../../lib/http/responses";
import { logger } from "../../lib/logger";

export const GET: APIRoute = async ({ locals }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { user, requestId } = locals as { user?: any; requestId?: string };

  if (!user) {
    logger.warn("strategies-get", "Unauthorized access attempt", { requestId });
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
