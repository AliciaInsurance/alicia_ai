-- Alicia AI application schema (not public)
CREATE SCHEMA IF NOT EXISTS alicia_ai;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Platform-wide behaviour (insurance rules, default locale, etc.)
CREATE TABLE alicia_ai.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alicia_ai.assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive')),
  customer_display_name text NOT NULL DEFAULT 'Alicia',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  system_instructions text NOT NULL DEFAULT '',
  greeting text NOT NULL DEFAULT '',
  fallback_message text NOT NULL DEFAULT '',
  personality_instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistants_status ON alicia_ai.assistants (status);
CREATE INDEX idx_assistants_slug ON alicia_ai.assistants (slug);

CREATE TABLE alicia_ai.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alicia_ai.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_source_id uuid NOT NULL
    REFERENCES alicia_ai.knowledge_sources (id) ON DELETE CASCADE,
  title text NOT NULL,
  filename text,
  mime_type text,
  source_type text NOT NULL
    CHECK (source_type IN ('manual', 'pdf', 'text', 'markdown')),
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  content_hash text,
  raw_text text,
  storage_path text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_documents_source ON alicia_ai.knowledge_documents (knowledge_source_id);
CREATE INDEX idx_knowledge_documents_status ON alicia_ai.knowledge_documents (status);

CREATE TABLE alicia_ai.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL
    REFERENCES alicia_ai.knowledge_documents (id) ON DELETE CASCADE,
  knowledge_source_id uuid NOT NULL
    REFERENCES alicia_ai.knowledge_sources (id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(1536),
  token_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_knowledge_chunks_source ON alicia_ai.knowledge_chunks (knowledge_source_id);

CREATE INDEX idx_knowledge_chunks_embedding ON alicia_ai.knowledge_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE TABLE alicia_ai.assistant_sources (
  assistant_id uuid NOT NULL
    REFERENCES alicia_ai.assistants (id) ON DELETE CASCADE,
  knowledge_source_id uuid NOT NULL
    REFERENCES alicia_ai.knowledge_sources (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assistant_id, knowledge_source_id)
);

CREATE TABLE alicia_ai.widget_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL UNIQUE
    REFERENCES alicia_ai.assistants (id) ON DELETE CASCADE,
  public_slug text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  position text NOT NULL DEFAULT 'bottom-right',
  primary_color text DEFAULT '#0f766e',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_widget_configs_public_slug ON alicia_ai.widget_configs (public_slug);

CREATE TABLE alicia_ai.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL
    REFERENCES alicia_ai.assistants (id) ON DELETE RESTRICT,
  widget_config_id uuid
    REFERENCES alicia_ai.widget_configs (id) ON DELETE SET NULL,
  anonymous_session_id text NOT NULL,
  referrer_url text,
  referrer_domain text,
  channel text NOT NULL DEFAULT 'widget'
    CHECK (channel IN ('widget', 'admin_test')),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_assistant ON alicia_ai.conversations (assistant_id);
CREATE INDEX idx_conversations_session ON alicia_ai.conversations (anonymous_session_id);

CREATE TABLE alicia_ai.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES alicia_ai.conversations (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  model text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON alicia_ai.messages (conversation_id, created_at);

-- Future: tools, MCP, handoffs, evaluations — reserved via metadata columns above

-- Similarity search scoped to assistant-attached sources
CREATE OR REPLACE FUNCTION alicia_ai.match_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_source_ids uuid[],
  match_count integer DEFAULT 6
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  knowledge_source_id uuid,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    c.knowledge_source_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM alicia_ai.knowledge_chunks c
  WHERE c.knowledge_source_id = ANY (match_source_ids)
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- updated_at triggers
CREATE OR REPLACE FUNCTION alicia_ai.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER assistants_updated_at
  BEFORE UPDATE ON alicia_ai.assistants
  FOR EACH ROW EXECUTE FUNCTION alicia_ai.set_updated_at();

CREATE TRIGGER knowledge_sources_updated_at
  BEFORE UPDATE ON alicia_ai.knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION alicia_ai.set_updated_at();

CREATE TRIGGER knowledge_documents_updated_at
  BEFORE UPDATE ON alicia_ai.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION alicia_ai.set_updated_at();

CREATE TRIGGER widget_configs_updated_at
  BEFORE UPDATE ON alicia_ai.widget_configs
  FOR EACH ROW EXECUTE FUNCTION alicia_ai.set_updated_at();

CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON alicia_ai.platform_settings
  FOR EACH ROW EXECUTE FUNCTION alicia_ai.set_updated_at();

-- Privileges: no direct anon/authenticated access to schema tables
REVOKE ALL ON SCHEMA alicia_ai FROM PUBLIC;
GRANT USAGE ON SCHEMA alicia_ai TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA alicia_ai TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA alicia_ai TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA alicia_ai TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA alicia_ai
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA alicia_ai
  GRANT ALL ON SEQUENCES TO service_role;
