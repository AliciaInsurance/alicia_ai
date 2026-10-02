import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export type DbHealth = {
  configured: boolean;
  reachable: boolean;
  assistantCount: number | null;
  code: string | null;
  message: string | null;
  hint: string | null;
};

function hintForMessage(message: string | null): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("schema") && lower.includes("alicia_ai")) {
    return "Supabase → Project Settings → API → Exposed schemas: add alicia_ai (keep public).";
  }
  if (lower.includes("invalid api key") || lower.includes("jwt")) {
    return "Check SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL match the same Supabase project.";
  }
  if (lower.includes("relation") && lower.includes("does not exist")) {
    return "Run supabase/migrations SQL on this project (init + seed).";
  }
  return null;
}

export async function checkAliciaAiDatabase(): Promise<DbHealth> {
  if (!isSupabaseAdminConfigured()) {
    return {
      configured: false,
      reachable: false,
      assistantCount: null,
      code: "missing_env",
      message: "NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set on the server.",
      hint: "Set both in Vercel → Environment Variables for Production, then redeploy.",
    };
  }

  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("assistants")
      .select("*", { count: "exact", head: true });

    if (error) {
      return {
        configured: true,
        reachable: false,
        assistantCount: null,
        code: error.code ?? "query_error",
        message: error.message,
        hint: hintForMessage(error.message),
      };
    }

    return {
      configured: true,
      reachable: true,
      assistantCount: count ?? 0,
      code: null,
      message: null,
      hint:
        (count ?? 0) === 0
          ? "DB is reachable but assistants is empty — run seed migration or confirm Vercel points at the project where you ran SQL."
          : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      reachable: false,
      assistantCount: null,
      code: "exception",
      message,
      hint: hintForMessage(message),
    };
  }
}
