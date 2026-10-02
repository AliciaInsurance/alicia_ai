export const dynamic = "force-dynamic";

import { checkAliciaAiDatabase } from "@/lib/supabase/status";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeDb = url.searchParams.get("db") === "1";

  const body: Record<string, unknown> = {
    ok: true,
    service: "alicia-ai",
    ts: new Date().toISOString(),
  };

  if (includeDb) {
    const db = await checkAliciaAiDatabase();
    body.db = db;
    body.ok = db.configured && db.reachable;
  }

  return Response.json(body);
}
