import type { APIRoute } from "astro";
import { createHash, randomUUID } from "node:crypto";

import { internalError, validationError } from "../../../lib/errors.ts";
import {
  errorResponse,
  jsonResponse,
  toApiError,
} from "../../../lib/http/responses.ts";
import { buildSessionCookies } from "../../../lib/http/sessionCookies.ts";
import { logger } from "../../../lib/logger.ts";
import { signIn } from "../../../lib/services/authService.ts";
import { authSigninSchema } from "../../../lib/validation/auth.ts";
import type { AuthSigninResponse } from "../../../types.ts";

const MAX_BODY_BYTES = 10 * 1024;
const EXPECTED_CONTENT_TYPE = "application/json";
const EVENT = "auth.signin";

const hashEmail = (email: string): string => {
  return createHash("sha256").update(email).digest("hex");
};

const readRequestBody = async (request: Request): Promise<string> => {
  try {
    return await request.text();
  } catch (cause) {
    throw internalError("BODY_READ_FAILED", "Unable to read request body", {
      cause,
    });
  }
};

const ensureJsonContentType = (contentType: string | null): void => {
  if (
    !contentType ||
    !contentType.toLowerCase().includes(EXPECTED_CONTENT_TYPE)
  ) {
    throw validationError(
      "INVALID_CONTENT_TYPE",
      "Content-Type must be application/json",
    );
  }
};

const enforceBodySize = (body: string): void => {
  const size = new TextEncoder().encode(body).length;
  if (size > MAX_BODY_BYTES) {
    throw validationError(
      "PAYLOAD_TOO_LARGE",
      "Request body exceeds 10KB limit",
    );
  }
};

const ensureNoQueryParams = (request: Request): void => {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].length > 0) {
    throw validationError("INVALID_QUERY", "Unexpected query parameters");
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = randomUUID();
  const startedAt = performance.now();
  let hashedEmail: string | undefined;

  try {
    ensureNoQueryParams(request);
    ensureJsonContentType(request.headers.get("content-type"));

    const rawBody = await readRequestBody(request);
    enforceBodySize(rawBody);

    let payload: unknown;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      throw validationError("INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = authSigninSchema.safeParse(payload);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => issue.message);
      throw validationError("VALIDATION_ERROR", "Invalid signin payload", {
        issues,
      });
    }

    const supabase = locals.supabase;
    if (!supabase) {
      throw internalError(
        "SUPABASE_CLIENT_MISSING",
        "Supabase client is not available",
      );
    }

    const { email, password } = parsed.data;
    hashedEmail = hashEmail(email);

    const signinResult = await signIn(supabase, { email, password });

    const response: AuthSigninResponse = {
      user: {
        id: signinResult.userId,
        email: signinResult.email,
      },
      session: {
        accessToken: signinResult.accessToken,
        refreshToken: signinResult.refreshToken,
      },
    };

    const sessionCookies = buildSessionCookies({
      accessToken: signinResult.accessToken,
      refreshToken: signinResult.refreshToken,
    });
    const headers: [string, string][] = [
      ["Cache-Control", "no-store"],
      ["X-Request-Id", requestId],
    ];

    sessionCookies.forEach((cookie) => {
      headers.push(["Set-Cookie", cookie]);
    });

    logger.info(EVENT, "Signin succeeded", {
      requestId,
      emailHash: hashedEmail,
      latencyMs: Math.round(performance.now() - startedAt),
    });

    return jsonResponse(response, {
      status: 200,
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

    if (hashedEmail) {
      logPayload.emailHash = hashedEmail;
    }

    if (apiError.status >= 500) {
      logger.error(EVENT, apiError.message, logPayload);
    } else {
      logger.warn(EVENT, apiError.message, logPayload);
    }

    return errorResponse(apiError, requestId);
  }
};
