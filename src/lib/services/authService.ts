import { AuthApiError, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import {
  conflictError,
  internalError,
  notFoundError,
  unauthorizedError,
  tooManyRequestsError,
  validationError,
} from "../errors.ts";
import type {
  AuthSigninParsed,
  AuthSignupParsed,
  AuthResetPasswordParsed,
} from "../validation/auth.ts";

export interface SignUpResult {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export interface SignInResult {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export async function signUp(
  supabase: SupabaseClient<Database>,
  { email, password }: AuthSignupParsed,
): Promise<SignUpResult> {
  if (!supabase) {
    throw internalError(
      "SUPABASE_CLIENT_MISSING",
      "Supabase client is not available",
    );
  }

  let result;
  try {
    result = await supabase.auth.signUp({ email, password });
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Signup service unavailable", {
      cause,
    });
  }

  const { data, error } = result;

  if (error) {
    const details = {
      supabaseStatus: error instanceof AuthApiError ? error.status : null,
      supabaseMessage: error.message,
    };

    if (error instanceof AuthApiError) {
      if (error.status === 429) {
        throw tooManyRequestsError(
          "RATE_LIMITED",
          "Too many signup attempts. Try again later.",
          details,
        );
      }

      if (
        error.status === 422 ||
        (error.status === 400 && /already registered/i.test(error.message))
      ) {
        throw conflictError(
          "EMAIL_EXISTS",
          "Email already registered",
          details,
        );
      }

      if (error.status >= 400 && error.status < 500) {
        throw validationError(
          "VALIDATION_ERROR",
          "Signup request rejected",
          details,
        );
      }
    }

    throw internalError("SUPABASE_ERROR", "Signup failed", {
      details,
      cause: error,
    });
  }

  if (!data.user?.id) {
    throw internalError(
      "INCOMPLETE_RESPONSE",
      "Signup response missing user identifier",
    );
  }

  if (!data.user.email) {
    throw internalError(
      "INCOMPLETE_RESPONSE",
      "Signup response missing user email",
    );
  }

  if (!data.session?.access_token || !data.session.refresh_token) {
    throw internalError(
      "INCOMPLETE_RESPONSE",
      "Signup response missing session tokens",
    );
  }

  return {
    userId: data.user.id,
    email: data.user.email,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export async function signIn(
  supabase: SupabaseClient<Database>,
  { email, password }: AuthSigninParsed,
): Promise<SignInResult> {
  if (!supabase) {
    throw internalError(
      "SUPABASE_CLIENT_MISSING",
      "Supabase client is not available",
    );
  }

  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Signin service unavailable", {
      cause,
    });
  }

  const { data, error } = result;

  if (error) {
    const details = {
      supabaseStatus: error instanceof AuthApiError ? error.status : null,
      supabaseMessage: error.message,
    };

    if (error instanceof AuthApiError) {
      if (error.status === 429) {
        throw tooManyRequestsError(
          "RATE_LIMITED",
          "Too many signin attempts. Try again later.",
          details,
        );
      }

      const invalidCredentials = /invalid (login )?credentials/i.test(
        error.message,
      );
      if (
        (error.status === 400 || error.status === 401) &&
        invalidCredentials
      ) {
        throw unauthorizedError(
          "INVALID_CREDENTIALS",
          "Invalid email or password",
          details,
        );
      }

      if (error.status === 401) {
        throw unauthorizedError(
          "INVALID_CREDENTIALS",
          "Invalid email or password",
          details,
        );
      }

      if (error.status >= 400 && error.status < 500) {
        throw validationError(
          "VALIDATION_ERROR",
          "Signin request rejected",
          details,
        );
      }
    }

    throw internalError("SUPABASE_ERROR", "Signin failed", {
      details,
      cause: error,
    });
  }

  if (!data.user?.id) {
    throw internalError(
      "INCOMPLETE_RESPONSE",
      "Signin response missing user identifier",
    );
  }

  if (!data.user.email) {
    throw internalError(
      "INCOMPLETE_RESPONSE",
      "Signin response missing user email",
    );
  }

  if (!data.session?.access_token || !data.session.refresh_token) {
    throw internalError(
      "INCOMPLETE_RESPONSE",
      "Signin response missing session tokens",
    );
  }

  return {
    userId: data.user.id,
    email: data.user.email,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

export async function signOut(
  supabase: SupabaseClient<Database>,
): Promise<void> {
  if (!supabase) {
    throw internalError(
      "SUPABASE_CLIENT_MISSING",
      "Supabase client is not available",
    );
  }

  let result;
  try {
    result = await supabase.auth.signOut();
  } catch (cause) {
    throw internalError("SUPABASE_UNAVAILABLE", "Signout service unavailable", {
      cause,
    });
  }

  const { error } = result;

  if (error) {
    const details = {
      supabaseStatus: error instanceof AuthApiError ? error.status : null,
      supabaseMessage: error.message,
    };

    if (error instanceof AuthApiError) {
      if (error.status === 429) {
        throw tooManyRequestsError(
          "RATE_LIMITED",
          "Too many signout attempts. Try again later.",
          details,
        );
      }

      if (error.status >= 400 && error.status < 500) {
        throw unauthorizedError("INVALID_SESSION", "Invalid session", details);
      }
    }

    throw internalError("SUPABASE_ERROR", "Signout failed", {
      details,
      cause: error,
    });
  }
}

export async function resetPassword(
  supabase: SupabaseClient<Database>,
  { email }: AuthResetPasswordParsed,
): Promise<{ accepted: boolean }> {
  if (!supabase) {
    throw internalError(
      "SUPABASE_CLIENT_MISSING",
      "Supabase client is not available",
    );
  }

  // Get redirect URL from env, fallback to origin
  const redirectTo =
    process.env.PUBLIC_RESET_PASSWORD_REDIRECT_URL ||
    "https://nosacz.com/reset-password";

  let result;
  try {
    result = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Reset password service unavailable",
      {
        cause,
      },
    );
  }

  const { error } = result;

  if (error) {
    const details = {
      supabaseStatus: error instanceof AuthApiError ? error.status : null,
      supabaseMessage: error.message,
    };

    if (error instanceof AuthApiError) {
      if (error.status === 429) {
        throw tooManyRequestsError(
          "RATE_LIMITED",
          "Too many reset password attempts. Try again later.",
          details,
        );
      }

      if (error.status === 404) {
        throw notFoundError("EMAIL_NOT_FOUND", "Email not found", details);
      }

      if (error.status >= 400 && error.status < 500) {
        throw validationError(
          "VALIDATION_ERROR",
          "Reset password request rejected",
          details,
        );
      }
    }

    throw internalError("SUPABASE_ERROR", "Reset password failed", {
      details,
      cause: error,
    });
  }

  return { accepted: true };
}
