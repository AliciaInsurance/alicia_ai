import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: any = null;

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/** Server-only Supabase client with access to alicia_ai schema via service role. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): any {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  if (adminClient) return adminClient;

  adminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "alicia_ai" },
  });

  return adminClient;
}
