# Alicia AI

Internal multi-assistant platform for Alicia customer-facing chat. **Alicia** is the customer-facing identity; multiple configured assistants can power different funnels while sharing architecture for knowledge, widgets, and conversations.

## Architecture (v0.1)

```text
Browser (admin / widget iframe)
  → Next.js API routes & server actions (auth + validation)
    → Supabase service role (schema: alicia_ai)
    → OpenAI (chat + embeddings, server-side only)
```

- **Assistants** — configuration (model, instructions, greeting, status).
- **Knowledge sources** — reusable collections; many-to-many with assistants.
- **Documents → chunks → embeddings** — simple RAG via `pgvector` and `match_knowledge_chunks`.
- **Single chat pipeline** — `runChat()` used by `/api/chat` for both widget and admin test.
- **Widget** — `/widget.js` launcher + `/embed/chat` iframe; no secrets in the browser.

## Repository status

This repo was bootstrapped as a greenfield Next.js 15 app (TypeScript, App Router, Tailwind 4). There was no pre-existing Alicia app code in the initial clone.

## Prerequisites

- Node.js 20+
- Existing Alicia Supabase project
- OpenAI API key
- Supabase Auth user(s) for admin login

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth session (admin UI) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB access to `alicia_ai` schema |
| `OPENAI_API_KEY` | Chat + embeddings (server only) |
| `NEXT_PUBLIC_APP_URL` | Public base URL for widget script/embed (production: `https://ask.alicia.insure`) |
| `ALICIA_AI_ADMIN_EMAILS` | Optional comma-separated admin email allowlist |

## Database setup

1. Enable **pgvector** in Supabase (`Database → Extensions → vector`).
2. Run migrations in order from `supabase/migrations/` (SQL editor or CLI).
3. In **Project Settings → API → Exposed schemas**, add `alicia_ai` so the server client can query the schema (service role still required; tables are not granted to `anon`/`authenticated`).
4. Confirm privileges: migrations revoke public access and grant `service_role` only on `alicia_ai` objects.

### Tables (schema `alicia_ai`)

| Table | Purpose |
|-------|---------|
| `platform_settings` | Platform-wide insurance behaviour rules |
| `assistants` | Assistant configuration |
| `knowledge_sources` | Reusable knowledge collections |
| `knowledge_documents` | Manual text / uploads + processing status |
| `knowledge_chunks` | Chunk text + embeddings |
| `assistant_sources` | Assistant ↔ source join |
| `widget_configs` | Public widget slug + styling hooks |
| `conversations` | Anonymous persisted chats |
| `messages` | Messages + retrieval/token metadata |

Function: `alicia_ai.match_knowledge_chunks` — cosine similarity search scoped to source IDs.

Seed migration creates **BAV Sales** demo assistant + **DEMO — BAV FAQ** (fake content only).

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` → redirects to `/assistants` (login required).

After migrations + seed, open the **BAV Sales** assistant and use **Test**, or embed the widget snippet from the Widget section.

```bash
npm run typecheck
npm run lint
```

## Admin usage

### Create an assistant

1. Sign in at `/login`.
2. Go to **Assistants** → create with internal name + slug.
3. Open the assistant → **General** / **Personality** → save.
4. Set status to **active** (or use Activate).

### Add knowledge

1. **Knowledge** → create a source, or use **Assistants → Knowledge → Attach**.
2. Open the source → add manual text or upload PDF/txt/md.
3. Processing runs server-side; status moves to **ready** (or **failed** with error).

### Test chat

Assistant detail → **Test** tab uses `/api/chat` with `channel: admin_test` (same orchestration as widget).

### Embed widget

```html
<script
  src="https://ask.alicia.insure/widget.js"
  data-assistant="bav-sales">
</script>
```

Optional: `data-primary-color="#0f766e"`.

## API routes

| Route | Description |
|-------|-------------|
| `POST /api/chat` | Public chat (rate-limited); admin test requires session |
| `GET /api/widget/config?assistant=` | Public widget metadata (no secrets) |
| `GET /widget.js` | Embed loader script |

## Security decisions (v0.1)

- OpenAI + service role keys **only on server**.
- `alicia_ai` schema **not granted** to `anon`/`authenticated`; admin mutations via server actions after Supabase Auth.
- Optional `ALICIA_AI_ADMIN_EMAILS` allowlist.
- Chat input validated with Zod; assistant slug restricted to `[a-z0-9-]`.
- RAG retrieval limited to sources **attached to the resolved assistant**.
- Upload type/size checks; filenames sanitized; no remote URL ingestion.
- In-memory rate limit on `/api/chat` (per IP, 30/min) — replace with Redis/Upstash for production multi-instance.
- Structured JSON logs without secrets; generic errors to customers.

## Known limitations / tech debt

- Rate limiting is in-process (not shared across Vercel instances).
- Document processing is synchronous in the upload request (fine for small v0.1 docs).
- Widget styling hooks exist in DB but minimal UI theming in v0.1.
- No Supabase Storage yet — extracted text stored in `knowledge_documents.raw_text`.
- Custom schema + pgvector operator paths may need tweaking per Supabase project (see migration comments).
- Admin UI is functional, not final brand polish.

## Recommended next steps

1. **Background document jobs** (queue/worker) for large PDFs + retry semantics.
2. **Shared rate limiting + WAF rules** on public chat endpoints.
3. **Tool/MCP orchestration layer** hook in `runChat()` (placeholder metadata already on messages).

## Routes & pages

- `/login` — admin auth
- `/assistants`, `/assistants/[id]` — assistant CRUD, knowledge attach, widget, test
- `/knowledge-sources`, `/knowledge-sources/[id]` — sources & documents
- `/embed/chat` — widget iframe UI
- `/widget.js` — embed script

## License

Internal Alicia project — proprietary.
