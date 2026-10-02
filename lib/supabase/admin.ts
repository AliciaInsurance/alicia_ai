import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";
import type { AliciaAiSchema, Database } from "@/lib/types/supabase-database";

export type AdminSupabaseClient = SupabaseClient<
  Database,
  "alicia_ai",
  AliciaAiSchema
>;

let adminClient: AdminSupabaseClient | null = null;

/** Server-only Supabase client with access to alicia_ai schema via service role. */
export function createAdminClient(): AdminSupabaseClient {
  if (adminClient) return adminClient;

  adminClient = createClient<Database, "alicia_ai", AliciaAiSchema>(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "alicia_ai" },
    }
  );

  return adminClient;
}
