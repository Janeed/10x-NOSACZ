import { randomUUID } from "node:crypto";
import { defineMiddleware } from "astro:middleware";

import { createSupabaseClient } from "../db/supabase.client.ts";
import {
  internalError,
  tooManyRequestsError,
  unauthorizedError,
} from "../lib/errors.ts";
import { errorResponse } from "../lib/http/responses.ts";
import { logger } from "../lib/logger.ts";

const PUBLIC_API_PATHS = new Set(["/api/auth/signin", "/api/auth/signup", "/api/auth/reset-password"]);

const normalizePathname = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const extractBearerToken = (
  authorizationHeader: string | null,
): string | undefined => {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, ...rest] = authorizationHeader.trim().split(/\s+/);
  if (!scheme || !/^Bearer$/i.test(scheme) || rest.length === 0) {
    return undefined;
  }

  const token = rest.join(" ").trim();
  return token || undefined;
};

const resolveRequestId = (request: Request): string => {
  return request.headers.get("x-request-id") ?? randomUUID();
};

const shouldEnforceAuth = (pathname: string, method: string): boolean => {
  if (method.toUpperCase() === "OPTIONS") {
    return false;
  }

  const normalized = normalizePathname(pathname);
  if (!normalized.startsWith("/api/")) {
    return false;
  }

  return !PUBLIC_API_PATHS.has(normalized);
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  const requestId = resolveRequestId(request);

  context.locals.requestId = requestId;

  const accessToken = extractBearerToken(request.headers.get("authorization"));
  const supabase = createSupabaseClient(accessToken);
  context.locals.supabase = supabase;

  const requiresAuth = shouldEnforceAuth(url.pathname, request.method);

  if (!accessToken) {
    if (requiresAuth) {
      logger.warn(
        "middleware.auth.missingToken",
        "Missing bearer token for protected route",
        {
          requestId,
          path: url.pathname,
          method: request.method,
        },
      );

      return errorResponse(
        unauthorizedError("AUTH_REQUIRED", "Authentication required"),
        requestId,
      );
    }

    const response = await next();
    if (!response.headers.has("X-Request-Id")) {
      response.headers.set("X-Request-Id", requestId);
    }
    return response;
  }

  let userResult;
  try {
    userResult = await supabase.auth.getUser(accessToken);
  } catch (cause) {
    logger.error(
      "middleware.auth.getUser.failure",
      "Failed to verify Supabase session",
      {
        requestId,
        path: url.pathname,
        method: request.method,
        cause,
      },
    );

    return errorResponse(
      internalError(
        "AUTH_VERIFICATION_FAILED",
        "Failed to verify authentication",
      ),
      requestId,
    );
  }

  const { data, error } = userResult;

  if (error || !data.user) {
    const status = error?.status ?? 401;

    if (status === 429) {
      logger.warn(
        "middleware.auth.rateLimited",
        "Authentication rate limited",
        {
          requestId,
          path: url.pathname,
          method: request.method,
        },
      );
      return errorResponse(
        tooManyRequestsError("RATE_LIMITED", "Too many requests"),
        requestId,
      );
    }

    logger.warn("middleware.auth.invalidToken", "Invalid access token", {
      requestId,
      path: url.pathname,
      method: request.method,
      supabaseMessage: error?.message,
    });

    return errorResponse(
      unauthorizedError("AUTH_REQUIRED", "Authentication required"),
      requestId,
    );
  }

  context.locals.userId = data.user.id;

  const response = await next();
  if (!response.headers.has("X-Request-Id")) {
    response.headers.set("X-Request-Id", requestId);
  }
  return response;
});
