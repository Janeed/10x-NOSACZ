import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types.ts";
import type {
  UpdateUserSettingsCommand,
  UserSettingsDto,
} from "../../types.ts";
import { conflictError, internalError, notFoundError } from "../errors.ts";
import { invalidateDashboardCache } from "./dashboardService.ts";

const SELECT_COLUMNS =
  "user_id, monthly_overpayment_limit, reinvest_reduced_payments, updated_at";
type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];

const toDto = (row: UserSettingsRow): UserSettingsDto => {
  return {
    userId: row.user_id,
    monthlyOverpaymentLimit: row.monthly_overpayment_limit,
    reinvestReducedPayments: row.reinvest_reduced_payments,
    updatedAt: row.updated_at,
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
      "User identifier is required to load settings",
    );
  }

  return userId;
};

const withSupabaseError = (error: { code: string; message: string } | null) => {
  if (!error) {
    return undefined;
  }

  return { supabaseCode: error.code, supabaseMessage: error.message };
};

const fetchExistingSettings = async (
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserSettingsRow | null> => {
  let result;
  try {
    result = await supabase
      .from("user_settings")
      .select(SELECT_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to load existing user settings",
      { cause },
    );
  }

  const { data, error } = result;

  if (error) {
    throw internalError(
      "SUPABASE_ERROR",
      "Failed to load existing user settings",
      {
        cause: error,
        details: withSupabaseError(error),
      },
    );
  }

  return data ?? null;
};

const insertUserSettings = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  command: UpdateUserSettingsCommand,
): Promise<UserSettingsRow | null> => {
  let result;
  try {
    result = await supabase
      .from("user_settings")
      .insert({
        user_id: userId,
        monthly_overpayment_limit: command.monthlyOverpaymentLimit,
        reinvest_reduced_payments: command.reinvestReducedPayments,
      })
      .select(SELECT_COLUMNS)
      .maybeSingle();
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to create user settings",
      { cause },
    );
  }

  const { data, error } = result;

  if (error) {
    if (error.code === "23505") {
      return null;
    }

    throw internalError("SUPABASE_ERROR", "Failed to create user settings", {
      cause: error,
      details: withSupabaseError(error),
    });
  }

  if (!data) {
    throw internalError("SUPABASE_ERROR", "Failed to create user settings", {
      details: { reason: "Insert returned no data" },
    });
  }

  return data;
};

const updateUserSettingsRow = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  command: UpdateUserSettingsCommand,
  current: UserSettingsRow,
  ifMatch?: string,
): Promise<UserSettingsRow> => {
  if (ifMatch && ifMatch !== current.updated_at) {
    throw conflictError(
      "USER_SETTINGS_VERSION_MISMATCH",
      "User settings were modified by another process",
    );
  }

  let result;
  try {
    result = await supabase
      .from("user_settings")
      .update({
        monthly_overpayment_limit: command.monthlyOverpaymentLimit,
        reinvest_reduced_payments: command.reinvestReducedPayments,
      })
      .eq("user_id", userId)
      .eq("updated_at", current.updated_at)
      .select(SELECT_COLUMNS)
      .maybeSingle();
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to update user settings",
      { cause },
    );
  }

  const { data, error } = result;

  if (error) {
    throw internalError("SUPABASE_ERROR", "Failed to update user settings", {
      cause: error,
      details: withSupabaseError(error),
    });
  }

  if (!data) {
    throw conflictError(
      "USER_SETTINGS_VERSION_MISMATCH",
      "User settings update conflict detected",
    );
  }

  return data;
};

export interface UpsertUserSettingsResult {
  dto: UserSettingsDto;
  created: boolean;
}

export async function getUserSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserSettingsDto> {
  const client = assertSupabaseClient(supabase);
  const resolvedUserId = assertUserId(userId);

  let result;
  try {
    result = await client
      .from("user_settings")
      .select(SELECT_COLUMNS)
      .eq("user_id", resolvedUserId)
      .maybeSingle();
  } catch (cause) {
    throw internalError(
      "SUPABASE_UNAVAILABLE",
      "Unable to fetch user settings",
      { cause },
    );
  }

  const { data, error } = result;

  if (error) {
    const details = {
      supabaseCode: error.code,
      supabaseMessage: error.message,
    };
    throw internalError("SUPABASE_ERROR", "Failed to fetch user settings", {
      cause: error,
      details,
    });
  }

  if (!data) {
    throw notFoundError(
      "USER_SETTINGS_NOT_FOUND",
      "User settings not initialized",
    );
  }

  return toDto(data);
}

export async function upsertUserSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
  command: UpdateUserSettingsCommand,
  ifMatch?: string,
): Promise<UpsertUserSettingsResult> {
  const client = assertSupabaseClient(supabase);
  const resolvedUserId = assertUserId(userId);

  const existing = await fetchExistingSettings(client, resolvedUserId);

  if (!existing) {
    const createdRow = await insertUserSettings(
      client,
      resolvedUserId,
      command,
    );
    if (createdRow) {
      // Invalidate dashboard cache since user settings changed
      invalidateDashboardCache(resolvedUserId);

      return {
        created: true,
        dto: toDto(createdRow),
      };
    }

    const refreshed = await fetchExistingSettings(client, resolvedUserId);
    if (!refreshed) {
      throw conflictError(
        "USER_SETTINGS_VERSION_MISMATCH",
        "Unable to resolve user settings after insert conflict",
      );
    }

    const updatedRow = await updateUserSettingsRow(
      client,
      resolvedUserId,
      command,
      refreshed,
      ifMatch,
    );
    // Invalidate dashboard cache since user settings changed
    invalidateDashboardCache(resolvedUserId);

    return {
      created: false,
      dto: toDto(updatedRow),
    };
  }

  const updatedRow = await updateUserSettingsRow(
    client,
    resolvedUserId,
    command,
    existing,
    ifMatch,
  );
  // Invalidate dashboard cache since user settings changed
  invalidateDashboardCache(resolvedUserId);

  return {
    created: false,
    dto: toDto(updatedRow),
  };
}
