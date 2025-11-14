import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../db/database.types.ts';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const createSupabaseClient = (accessToken?: string): SupabaseClient<Database> => {
	const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

	return createClient<Database>(supabaseUrl, supabaseAnonKey, {
		global: headers ? { headers } : undefined,
	});
};

export const supabaseClient = createSupabaseClient();
