import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../db/database.types.ts';
import type { UserSettingsDto } from '../../types.ts';
import { internalError, notFoundError } from '../errors.ts';

const SELECT_COLUMNS = 'user_id, monthly_overpayment_limit, reinvest_reduced_payments, updated_at';

export async function getUserSettings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserSettingsDto> {
  if (!supabase) {
    throw internalError('SUPABASE_CLIENT_MISSING', 'Supabase client is not available');
  }

  if (!userId) {
    throw internalError('USER_IDENTIFIER_MISSING', 'User identifier is required to load settings');
  }

  let result;
  try {
    result = await supabase
      .from('user_settings')
      .select(SELECT_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
  } catch (cause) {
    throw internalError('SUPABASE_UNAVAILABLE', 'Unable to fetch user settings', { cause });
  }

  const { data, error } = result;

  if (error) {
    const details = { supabaseCode: error.code, supabaseMessage: error.message };
    throw internalError('SUPABASE_ERROR', 'Failed to fetch user settings', { cause: error, details });
  }

  if (!data) {
    throw notFoundError('USER_SETTINGS_NOT_FOUND', 'User settings not initialized');
  }

  return {
    userId: data.user_id,
    monthlyOverpaymentLimit: data.monthly_overpayment_limit,
    reinvestReducedPayments: data.reinvest_reduced_payments,
    updatedAt: data.updated_at,
  };
}
