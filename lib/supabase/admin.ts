import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

let adminClient: ReturnType<typeof createClient> | null = null;

/** Server-only Supabase client with access to alicia_ai schema via service role. */
export function createAdminClient() {
  if (adminClient) return adminClient;

  adminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "alicia_ai" },
  });

  return adminClient;
}
