import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";
import type { Database } from "@/lib/types/supabase-database";

let adminClient: SupabaseClient<Database, "alicia_ai"> | null = null;

/** Server-only Supabase client with access to alicia_ai schema via service role. */
export function createAdminClient(): SupabaseClient<Database, "alicia_ai"> {
  if (adminClient) return adminClient;

  adminClient = createClient<Database, "alicia_ai">(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "alicia_ai" },
    }
  );

  return adminClient;
}
