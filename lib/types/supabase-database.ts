import type {
  Assistant,
  Conversation,
  KnowledgeItem,
  KnowledgeSource,
  MatchedChunk,
  Message,
  WidgetConfig,
} from "@/lib/types/database";

type Table<T extends Record<string, unknown>> = {
  Row: T;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export interface KnowledgeChunk extends Record<string, unknown> {
  id: string;
  document_id: string;
  knowledge_source_id: string;
  chunk_index: number;
  content: string;
  embedding: number[] | null;
  token_count: number | null;
  page_from: number | null;
  page_to: number | null;
  created_at: string;
}

export interface AssistantSource extends Record<string, unknown> {
  assistant_id: string;
  knowledge_source_id: string;
  created_at: string;
}

export interface PlatformSetting extends Record<string, unknown> {
  id: string;
  key: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStructuredRow extends Record<string, unknown> {
  id: string;
  document_id: string;
  row_index: number;
  row_data: Record<string, string>;
  created_at: string;
}

/** Supabase GenericSchema-compatible shape for the alicia_ai Postgres schema. */
export type AliciaAiSchema = {
  Tables: {
    assistants: Table<Assistant & Record<string, unknown>>;
    knowledge_sources: Table<KnowledgeSource & Record<string, unknown>>;
    knowledge_documents: Table<KnowledgeItem & Record<string, unknown>>;
    knowledge_chunks: Table<KnowledgeChunk>;
    knowledge_structured_rows: Table<KnowledgeStructuredRow>;
    assistant_sources: Table<AssistantSource>;
    widget_configs: Table<WidgetConfig & Record<string, unknown>>;
    conversations: Table<Conversation & Record<string, unknown>>;
    messages: Table<Message & Record<string, unknown>>;
    platform_settings: Table<PlatformSetting>;
  };
  Views: Record<string, never>;
  Functions: {
    match_knowledge_chunks: {
      Args: Record<string, unknown>;
      Returns: MatchedChunk[];
    };
  };
};

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
  alicia_ai: AliciaAiSchema;
};
