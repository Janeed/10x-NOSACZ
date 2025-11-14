import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import { internalError } from "../errors.ts";

type SupabaseErrorPayload = { code: string; message: string } | null;

const withSupabaseError = (
  error: SupabaseErrorPayload,
): Record<string, string> | undefined => {
  if (!error) {
    return undefined;
  }

  return {
    supabaseCode: error.code,
    supabaseMessage: error.message,
  };
};

const assertSupabaseClient = (
  supabase: SupabaseClient<Database> | undefined,
): SupabaseClient<Database> => {
  if (!supabase) {
    throw internalError(
      "SUPABASE_CLIENT_MISSING",
      "Supabase client is not available",
    );
  }

  return supabase;
};

const assertUserId = (userId: string | undefined): string => {
  if (!userId) {
    throw internalError(
      "USER_IDENTIFIER_MISSING",
      "User identifier is required to update simulations",
    );
  }

  return userId;
};

export const markActiveSimulationStale = async (
  supabaseClient: SupabaseClient<Database> | undefined,
  userId: string | undefined,
): Promise<boolean> => {
  const supabase = assertSupabaseClient(supabaseClient);
  const resolvedUserId = assertUserId(userId);

  let result;
  try {
    result = await supabase
      .from("simulations")
      .update({ stale: true })
      .eq("user_id", resolvedUserId)
      .eq("is_active", true)
      .eq("stale", false)
      .select("id");
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to mark simulations as stale",
      { cause },
    );
  }

  const { data, error } = result;

  if (error) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to mark simulations as stale",
      {
        cause: error,
        details: withSupabaseError(error),
      },
    );
  }

  if (!data) {
    return false;
  }

  return Array.isArray(data) ? data.length > 0 : true;
};
