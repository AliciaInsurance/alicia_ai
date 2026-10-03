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
- Google Workspace (@alicia.insure) via **Auth.js / NextAuth** (same pattern as Gold/Kalinda)

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (database only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB access to `alicia_ai` schema |
| `OPENAI_API_KEY` | Chat + embeddings (server only) |
| `NEXT_PUBLIC_APP_URL` | Public base URL for widget script/embed (production: `https://ask.alicia.insure`) |
| `AUTH_SECRET` | Auth.js session secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (Workspace) |
| `AUTH_URL` | Optional; production canonical URL is `https://ask.alicia.insure` |
| `ALICIA_AI_ADMIN_EMAILS` | Optional extra allowlist (still requires `@alicia.insure`) |
| `DEMO_MODE=true` | Local only: skip auth (never on production) |

### Admin authentication (Google SSO via Auth.js)

Same architecture as **Gold** and **Kalinda**: Google OAuth → Auth.js JWT session → server-side `@alicia.insure` check (fail closed).

1. Create a **Google Cloud OAuth client** (Web application).
2. **Authorized redirect URIs**:
   - `https://ask.alicia.insure/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_SECRET` in Vercel / `.env.local`.
4. Admin login is **Google only** (no Supabase Auth, no passwords). Public widget/chat stays anonymous.

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
| `knowledge_documents` | Manual text / uploads / URLs + extraction & review metadata |
| `knowledge_chunks` | Chunk text + embeddings + optional `page_from` / `page_to` |
| `assistant_sources` | Assistant ↔ source join |
| `widget_configs` | Public widget slug + styling hooks |
| `conversations` | Anonymous persisted chats |
| `messages` | Messages + retrieval/token metadata |

Function: `alicia_ai.match_knowledge_chunks` — cosine similarity search scoped to source IDs.

Seed migration creates **BAV Sales** demo assistant + widget only (demo FAQ knowledge is removed by later migrations).

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
npm run test:knowledge
```

## Admin usage

### Create an assistant

1. Sign in at `/login`.
2. Go to **Assistants** → create with internal name + slug.
3. Open the assistant → **General** / **Personality** → save.
4. Set status to **active** (or use Activate).

### Knowledge model (sources + items)

**Knowledge sources** are reusable collections (e.g. “BAV Product Knowledge”). **Assistants attach to sources**, not individual items.

Each source holds **knowledge items** of four types:

| Type | Use for |
|------|---------|
| **Tekst** (`manual_text`) | FAQ, handmatige uitleg, correcties |
| **Bestand** (`document`) | PDF (tekstlaag), TXT, MD — polisvoorwaarden, IPID, clauses |
| **Link** (`web`) | Eén publieke URL → HTML-tekst of PDF via document-pipeline |
| **Data** (`structured_data`) | CSV/JSON — beroepenlijsten, matrices (rijen + fallback-tekst voor RAG) |

**Flow:** toevoegen → verwerken (chunk/embed waar nodig) → preview → **Goedkeuren** → actief in retrieval.

- **Review:** `draft` · `pending_review` · `approved` · `rejected` — alleen **`approved`** items worden opgehaald.
- **Status:** `uploaded` · `processing` · `ready` · `failed` · **`unsupported`** (geen bruikbare PDF-tekstlaag).
- **Geldigheid:** optioneel `valid_from` / `valid_until` + `version_label`; retrieval negeert expired/toekomstige items.

**PDFs:** alleen PDF met **selecteerbare tekstlaag** (`pdf-parse` + kwaliteitscheck). Image-only/scans → **`unsupported`** met boodschap om een OCR/tekstversie of handmatige tekst te leveren. **Geen OCR/vision in Ask Alicia.**

**URLs:** SSRF-safe fetch; routing op Content-Type — HTML → leesbare tekst, PDF → document-pipeline, plain/markdown → tekst; overige types → duidelijke afwijzing. Geen site-crawl.

**Structured data:** rijen in `knowledge_structured_rows` (jsonb per rij) + searchable tekstrepresentatie voor pgvector; bedoeld voor latere deterministische lookup.

Max upload/URL-grootte: **8 MB** (synchroon in request).

**Documentprioriteit:** zet per item **Product** (bijv. `AVB`), **Documenttype** (`Voorwaarden`, `IPID`, `FAQ`) en optioneel **Prioriteit** (`authority_rank`, lager = leidend). Bij conflict geldt: voorwaarden > IPID > FAQ. Retrieval rerankt vector-resultaten op prioriteit en filtert product-mismatch (AVB vs BAV). Na metadata-wijziging: **Opnieuw verwerken** op elk item.

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
| `POST /api/chat` | Public chat (dev-only in-memory rate limit); admin test requires session |
| `GET /api/widget/config?assistant=` | Public widget metadata (no secrets) |
| `GET /widget.js` | Embed loader script |
| `GET /api/health` | Deployment health check (`{"ok":true}`) |

## Vercel (Alicia internal app bootstrap)

Ship **`vercel.json` in the first commit** (same pattern as Gardner/Kalinda):

- `"framework": "nextjs"` — without this, `npm run build` can succeed in logs but Vercel may not attach Next.js routing → platform **404** on every path.
- `"github": { "autoAlias": true }` — production alias to the custom domain.
- `"regions": ["fra1"]`, `"alias": ["ask.alicia.insure"]`.

**Do not** set a custom **Output Directory** in the Vercel UI for Next.js (leave blank).

**Edge auth:** use cookie-only `middleware.ts` (Gardner pattern). Never call NextAuth `auth()` on Edge — it causes `MIDDLEWARE_INVOCATION_FAILED`.

**Smoke tests after deploy:** `GET /deploy-stamp.txt` (static), `GET /api/health`, `/login`.

Admin authorization remains server-side (`requireAdminUser()` in layouts + Auth.js callbacks).

## Security decisions (v0.1)

- OpenAI + service role keys **only on server**.
- `alicia_ai` schema **not granted** to `anon`/`authenticated`; admin mutations via server actions after Auth.js session checks.
- Optional `ALICIA_AI_ADMIN_EMAILS` allowlist.
- Chat input validated with Zod; assistant slug restricted to `[a-z0-9-]`.
- RAG retrieval limited to sources **attached to the resolved assistant**.
- Upload type/size checks; filenames sanitized; URL ingestion with SSRF-safe fetch (DNS + private IP blocking).
- **Development-only** in-memory rate limit on `/api/chat` (per IP, 30/min). This is **not** reliable production abuse protection (not shared across instances, resets on cold start). **Production prerequisite:** Redis/Upstash (or equivalent) before go-live.
- Structured JSON logs without secrets; generic errors to customers.

## Known limitations / tech debt

- Rate limiting is in-process and suitable for **local development only** — not shared across Vercel instances; do not treat it as production-ready.
- Document processing is synchronous in the upload/URL request (within size limits).
- No OCR for scanned PDFs; admins must supply text-layer PDFs or manual text.
- Knowledge requires explicit approval before RAG retrieval uses it.
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
