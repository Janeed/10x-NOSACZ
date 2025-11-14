import { AuthApiError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../db/database.types.ts';
import {
  conflictError,
  internalError,
  tooManyRequestsError,
  validationError,
} from '../errors.ts';
import type { AuthSignupParsed } from '../validation/auth.ts';

export type SignUpResult = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

export async function signUp(
  supabase: SupabaseClient<Database>,
  { email, password }: AuthSignupParsed,
): Promise<SignUpResult> {
  if (!supabase) {
    throw internalError('SUPABASE_CLIENT_MISSING', 'Supabase client is not available');
  }

  let result;
  try {
    result = await supabase.auth.signUp({ email, password });
  } catch (cause) {
    throw internalError('SUPABASE_UNAVAILABLE', 'Signup service unavailable', { cause });
  }

  const { data, error } = result;

  if (error) {
    const details = { supabaseStatus: error instanceof AuthApiError ? error.status : null, supabaseMessage: error.message };

    if (error instanceof AuthApiError) {
      if (error.status === 429) {
        throw tooManyRequestsError('RATE_LIMITED', 'Too many signup attempts. Try again later.', details);
      }

      if (error.status === 422 || (error.status === 400 && /already registered/i.test(error.message))) {
        throw conflictError('EMAIL_EXISTS', 'Email already registered', details);
      }

      if (error.status >= 400 && error.status < 500) {
        throw validationError('VALIDATION_ERROR', 'Signup request rejected', details);
      }
    }

    throw internalError('SUPABASE_ERROR', 'Signup failed', { details, cause: error });
  }

  if (!data.user?.id) {
    throw internalError('INCOMPLETE_RESPONSE', 'Signup response missing user identifier');
  }

  if (!data.user.email) {
    throw internalError('INCOMPLETE_RESPONSE', 'Signup response missing user email');
  }

  if (!data.session?.access_token || !data.session.refresh_token) {
    throw internalError('INCOMPLETE_RESPONSE', 'Signup response missing session tokens');
  }

  return {
    userId: data.user.id,
    email: data.user.email,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}
