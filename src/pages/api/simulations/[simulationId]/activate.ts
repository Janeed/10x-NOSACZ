import type { APIRoute } from "astro";
import { createHash } from "node:crypto";

import { unauthorizedError, validationError } from "../../../../lib/errors.ts";
import { errorResponse, ok } from "../../../../lib/http/responses.ts";
import { logger } from "../../../../lib/logger.ts";
import { activateSimulation } from "../../../../lib/services/simulationService.ts";
import { simulationIdParamSchema } from "../../../../lib/validation/simulation.ts";
import type { SimulationActivationResponse } from "../../../../types.ts";

const EVENT_ACTIVATE = "simulations.activate";

const hashUserId = (userId: string): string => {
  return createHash("sha256").update(userId).digest("hex");
};

const ensureAuthenticated = (userId: string | undefined): string => {
  if (!userId) {
    throw unauthorizedError("AUTH_REQUIRED", "Authentication required");
  }
  return userId;
};

export const POST: APIRoute = async ({ params, locals }) => {
  const requestId = locals.requestId;
  const userId = ensureAuthenticated(locals.userId);
  const supabase = locals.supabase;

  try {
    // Validate simulationId
    const idValidation = simulationIdParamSchema.safeParse(params.simulationId);
    if (!idValidation.success) {
      return errorResponse(
        validationError("INVALID_ID", "Invalid simulation ID"),
        requestId,
      );
    }
    const simulationId = idValidation.data;

    // Call service
    const result: SimulationActivationResponse = await activateSimulation(
      supabase,
      userId,
      simulationId,
    );

    logger.info(EVENT_ACTIVATE, "Simulation activated", {
      userId: hashUserId(userId),
      simulationId,
      requestId,
    });

    return ok(result, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
