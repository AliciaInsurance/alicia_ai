import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: any = null;

/** Server-only Supabase client with access to alicia_ai schema via service role. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): any {
  if (adminClient) return adminClient;

  adminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "alicia_ai" },
  });

  return adminClient;
}
