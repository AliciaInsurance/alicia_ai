import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/env";

export type DbHealth = {
  configured: boolean;
  reachable: boolean;
  assistantCount: number | null;
  code: string | null;
  message: string | null;
  hint: string | null;
  /** Safe diagnostic detail for ops (no secrets). */
  detail: string | null;
};

function formatPostgrestError(error: PostgrestError): {
  code: string | null;
  message: string;
  detail: string | null;
} {
  const code = error.code ?? null;
  const messageParts = [error.message, error.details, error.hint].filter(
    (part) => typeof part === "string" && part.trim().length > 0,
  ) as string[];

  let message = messageParts.join(" — ");
  if (!message) {
    try {
      message = JSON.stringify(error);
    } catch {
      message = "Unknown PostgREST error (empty message)";
    }
  }

  return { code, message, detail: error.details ?? null };
}

function hintForDbError(code: string | null, message: string): string | null {
  const lower = message.toLowerCase();

  if (
    code === "PGRST106" ||
    code === "PGRST107" ||
    (lower.includes("schema") && lower.includes("alicia_ai")) ||
    lower.includes("invalid schema") ||
    lower.includes("accept-profile")
  ) {
    return "Supabase → Project Settings → API → Exposed schemas: add alicia_ai (keep public). Save, wait ~1 min, redeploy is not required for this setting.";
  }

  if (
    code === "PGRST204" ||
    code === "PGRST205" ||
    (lower.includes("relation") && lower.includes("does not exist")) ||
    lower.includes("could not find the table")
  ) {
    return "Run both SQL migrations in supabase/migrations on this Supabase project (init schema + seed).";
  }

  if (lower.includes("invalid api key") || lower.includes("jwt") || code === "401") {
    return "SUPABASE_SERVICE_ROLE_KEY must be the service_role secret from the same project as NEXT_PUBLIC_SUPABASE_URL.";
  }

  if (code === "query_error" && !message.trim()) {
    return "PostgREST returned an empty error — almost always missing alicia_ai in Exposed schemas, or migrations not applied on this project.";
  }

  return null;
}

async function probeRestApi(): Promise<{ ok: boolean; status: number; body: string }> {
  const base = getSupabaseUrl().replace(/\/$/, "");
  const key = getSupabaseServiceRoleKey();
  const url = `${base}/rest/v1/assistants?select=id&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Accept-Profile": "alicia_ai",
      "Content-Profile": "alicia_ai",
    },
    cache: "no-store",
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
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
      detail: null,
    };
  }

  try {
    const supabase = createAdminClient();
    const { data, error, count } = await supabase
      .from("assistants")
      .select("id", { count: "exact" })
      .limit(1);

    if (!error) {
      return {
        configured: true,
        reachable: true,
        assistantCount: count ?? data?.length ?? 0,
        code: null,
        message: null,
        hint:
          (count ?? 0) === 0
            ? "DB is reachable but assistants is empty — run seed migration or confirm Vercel points at the project where you ran SQL."
            : null,
        detail: null,
      };
    }

    const formatted = formatPostgrestError(error);
    let hint = hintForDbError(formatted.code, formatted.message);
    let detail = formatted.detail;
    let message = formatted.message;
    let code = formatted.code ?? "query_error";

    if (!formatted.message.trim() || code === "query_error") {
      try {
        const rest = await probeRestApi();
        detail = `REST ${rest.status}: ${rest.body}`;
        if (!rest.ok && !hint) {
          hint = hintForDbError(String(rest.status), rest.body);
        }
        if (!message.trim()) {
          message = rest.ok ? "JS client failed but REST probe succeeded" : `REST probe failed (${rest.status})`;
        }
      } catch (probeErr) {
        const probeMessage =
          probeErr instanceof Error ? probeErr.message : String(probeErr);
        detail = detail ?? `REST probe: ${probeMessage}`;
      }
    }

    return {
      configured: true,
      reachable: false,
      assistantCount: null,
      code,
      message,
      hint,
      detail,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      reachable: false,
      assistantCount: null,
      code: "exception",
      message,
      hint: hintForDbError(null, message),
      detail: null,
    };
  }
}
