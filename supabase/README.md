# Supabase migrations — Alicia AI

Apply SQL files in timestamp order via Supabase SQL editor or `supabase db push`.

After applying:

1. Add `alicia_ai` to **API → Exposed schemas**.
2. Run seed migration, then open admin → **BAV Sales** (demo assistant) to trigger pending document processing, or use **Process pending** on the demo knowledge source.

If `extensions.vector` types fail, ensure the **vector** extension is enabled. Some projects use `vector(1536)` without the `extensions.` prefix — adjust the migration locally if needed.
