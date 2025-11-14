import type { APIRoute } from 'astro';

import { unauthorizedError, validationError } from '../../lib/errors.ts';
import { errorResponse, jsonResponse, toApiError } from '../../lib/http/responses.ts';
import { getUserSettings } from '../../lib/services/userSettingsService.ts';
import { logger } from '../../lib/logger.ts';

const ensureNoQueryParams = (request: Request): void => {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].length > 0) {
    throw validationError('INVALID_QUERY', 'Unexpected query parameters');
  }
};

const resolveRequestId = (localsRequestId: string | undefined, request: Request): string | undefined => {
  if (localsRequestId) {
    return localsRequestId;
  }

  const headerValue = request.headers.get('x-request-id');
  return headerValue ?? undefined;
};

export const GET: APIRoute = async ({ locals, request }) => {
  const requestId = resolveRequestId(locals.requestId, request);

  try {
    ensureNoQueryParams(request);

    const userId = locals.userId;
    if (!userId) {
      throw unauthorizedError('AUTH_REQUIRED', 'Authentication required');
    }

    const userSettings = await getUserSettings(locals.supabase, userId);

    const successContext: Record<string, unknown> = { userId };
    if (requestId) {
      successContext.requestId = requestId;
    }

    logger.info('userSettings.fetch.success', 'Fetched user settings', successContext);

    return jsonResponse(userSettings, {
      status: 200,
      headers: requestId ? { 'X-Request-Id': requestId } : undefined,
    });
  } catch (error) {
    const apiError = toApiError(error);

    const logContext: Record<string, unknown> = {
      status: apiError.status,
      code: apiError.code,
    };

    if (requestId) {
      logContext.requestId = requestId;
    }

    if (locals.userId) {
      logContext.userId = locals.userId;
    }

    if (apiError.status === 404) {
      logger.warn('userSettings.fetch.notFound', apiError.message, logContext);
    } else if (apiError.status >= 500) {
      logger.error('userSettings.fetch.error', apiError.message, logContext);
    } else {
      logger.warn('userSettings.fetch.failure', apiError.message, logContext);
    }

    return errorResponse(apiError, requestId);
  }
};
