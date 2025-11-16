import type { APIRoute } from "astro";
import { createHash } from "node:crypto";

import { unauthorizedError } from "../../../lib/errors.ts";
import { errorResponse, ok } from "../../../lib/http/responses.ts";
import { logger } from "../../../lib/logger.ts";
import {
  listSimulations,
  queueSimulation,
} from "../../../lib/services/simulationService.ts";
import {
  simulationListQuerySchema,
  createSimulationSchema,
} from "../../../lib/validation/simulation.ts";
import type {
  SimulationListResponse,
  SimulationQueuedResponse,
} from "../../../types.ts";

const EVENT_LIST = "simulations.list";
const EVENT_QUEUE = "simulations.queue";

const hashUserId = (userId: string): string => {
  return createHash("sha256").update(userId).digest("hex");
};

const ensureAuthenticated = (userId: string | undefined): string => {
  if (!userId) {
    throw unauthorizedError("AUTH_REQUIRED", "Authentication required");
  }
  return userId;
};

export const GET: APIRoute = async ({ request, locals }) => {
  const requestId = locals.requestId;
  const userId = ensureAuthenticated(locals.userId);
  const supabase = locals.supabase;

  try {
    // Parse and validate query params
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const queryValidation = simulationListQuerySchema.safeParse(queryParams);

    if (!queryValidation.success) {
      return errorResponse(
        {
          code: "INVALID_QUERY",
          message: "Invalid query parameters",
          status: 400,
          details: queryValidation.error.issues,
        },
        requestId,
      );
    }

    const query = queryValidation.data;

    // Call service
    const result: SimulationListResponse = await listSimulations(
      supabase,
      userId,
      query,
    );

    logger.info(EVENT_LIST, "Simulations listed", {
      userId: hashUserId(userId),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.totalItems,
      requestId,
    });

    return ok(result, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = locals.requestId;
  const userId = ensureAuthenticated(locals.userId);
  const supabase = locals.supabase;

  try {
    // Parse and validate body
    const body = await request.json();
    const bodyValidation = createSimulationSchema.safeParse(body);

    if (!bodyValidation.success) {
      return errorResponse(
        {
          code: "INVALID_BODY",
          message: "Invalid request body",
          status: 400,
          details: bodyValidation.error.issues,
        },
        requestId,
      );
    }

    const cmd = bodyValidation.data;

    // Call service
    const result: SimulationQueuedResponse = await queueSimulation(
      supabase,
      userId,
      cmd,
      { requestId },
    );

    logger.info(EVENT_QUEUE, "Simulation queued", {
      userId: hashUserId(userId),
      simulationId: result.simulationId,
      strategy: cmd.strategy,
      goal: cmd.goal,
      requestId,
    });

    // Return 202 Accepted
    return new Response(JSON.stringify(result), {
      status: 202,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Request-Id": requestId || "",
      },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
