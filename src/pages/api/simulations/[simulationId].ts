import type { APIRoute } from "astro";
import { createHash } from "node:crypto";

import { unauthorizedError, validationError } from "../../../lib/errors.ts";
import { errorResponse, ok } from "../../../lib/http/responses.ts";
import { logger } from "../../../lib/logger.ts";
import { getSimulationDetail } from "../../../lib/services/simulationService.ts";
import {
  simulationIdParamSchema,
  includeParamSchema,
} from "../../../lib/validation/simulation.ts";
import type { SimulationDetailDto } from "../../../types.ts";

const EVENT_DETAIL = "simulations.detail";

const hashUserId = (userId: string): string => {
  return createHash("sha256").update(userId).digest("hex");
};

const ensureAuthenticated = (userId: string | undefined): string => {
  if (!userId) {
    throw unauthorizedError("AUTH_REQUIRED", "Authentication required");
  }
  return userId;
};

export const GET: APIRoute = async ({ params, request, locals }) => {
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

    // Parse include param
    const url = new URL(request.url);
    const includeParam = url.searchParams.get("include") ?? undefined;
    const includeValidation = includeParamSchema.safeParse(includeParam);
    if (!includeValidation.success) {
      return errorResponse(
        validationError("INVALID_INCLUDE", "Invalid include parameter"),
        requestId,
      );
    }
    const include = includeValidation.data;

    // Call service
    const result: SimulationDetailDto = await getSimulationDetail(
      supabase,
      userId,
      simulationId,
      include,
      { requestId },
    );

    logger.info(EVENT_DETAIL, "Simulation detail fetched", {
      userId: hashUserId(userId),
      simulationId,
      include,
      requestId,
    });

    return ok(result, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
