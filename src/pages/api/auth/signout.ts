import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { internalError, validationError } from "../../../lib/errors.ts";
import { errorResponse, toApiError } from "../../../lib/http/responses.ts";
import { buildSessionClearCookies } from "../../../lib/http/sessionCookies.ts";
import { logger } from "../../../lib/logger.ts";
import { signOut } from "../../../lib/services/authService.ts";

const EVENT = "auth.signout";

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = locals.requestId || randomUUID();
  const startedAt = performance.now();

  try {
    // Ensure no body (idempotent operation)
    if (request.body) {
      const body = await request.text();
      if (body.trim()) {
        throw validationError("UNEXPECTED_BODY", "Request body must be empty");
      }
    }

    const supabase = locals.supabase;
    if (!supabase) {
      throw internalError(
        "SUPABASE_CLIENT_MISSING",
        "Supabase client is not available",
      );
    }

    await signOut(supabase);

    const clearCookies = buildSessionClearCookies();
    const headers: Array<[string, string]> = [["X-Request-Id", requestId]];
    clearCookies.forEach((cookie) => {
      headers.push(["Set-Cookie", cookie]);
    });

    logger.info(EVENT, "Signout succeeded", {
      requestId,
      latencyMs: Math.round(performance.now() - startedAt),
    });

    return new Response(null, {
      status: 204,
      headers,
    });
  } catch (error) {
    const apiError = toApiError(error);
    const latencyMs = Math.round(performance.now() - startedAt);
    const logPayload: Record<string, unknown> = {
      requestId,
      status: apiError.status,
      code: apiError.code,
      latencyMs,
    };

    if (apiError.status >= 500) {
      logger.error(EVENT, apiError.message, logPayload);
    } else {
      logger.warn(EVENT, apiError.message, logPayload);
    }

    return errorResponse(apiError, requestId);
  }
};
