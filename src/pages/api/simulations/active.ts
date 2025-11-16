import type { APIRoute } from "astro";
import { createHash } from "node:crypto";

import { unauthorizedError } from "../../../lib/errors.ts";
import { errorResponse, ok } from "../../../lib/http/responses.ts";
import { logger } from "../../../lib/logger.ts";
import { getActiveSimulationDashboard } from "../../../lib/services/simulationService.ts";
import type { ActiveSimulationDashboardDto } from "../../../types.ts";

const EVENT_ACTIVE = "simulations.active";

const hashUserId = (userId: string): string => {
  return createHash("sha256").update(userId).digest("hex");
};

const ensureAuthenticated = (userId: string | undefined): string => {
  if (!userId) {
    throw unauthorizedError("AUTH_REQUIRED", "Authentication required");
  }
  return userId;
};

export const GET: APIRoute = async ({ locals }) => {
  const requestId = locals.requestId;
  const userId = ensureAuthenticated(locals.userId);
  const supabase = locals.supabase;

  try {
    // Call service
    const result: ActiveSimulationDashboardDto =
      await getActiveSimulationDashboard(supabase, userId);

    logger.info(EVENT_ACTIVE, "Active simulation dashboard fetched", {
      userId: hashUserId(userId),
      simulationId: result.id,
      requestId,
    });

    return ok(result, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
