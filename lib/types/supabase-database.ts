import type {
  Assistant,
  Conversation,
  KnowledgeDocument,
  KnowledgeSource,
  MatchedChunk,
  Message,
  WidgetConfig,
} from "@/lib/types/database";

type Table<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  knowledge_source_id: string;
  chunk_index: number;
  content: string;
  embedding: number[] | null;
  token_count: number | null;
  created_at: string;
}

export interface AssistantSource {
  assistant_id: string;
  knowledge_source_id: string;
  created_at: string;
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  alicia_ai: {
    Tables: {
      assistants: Table<Assistant>;
      knowledge_sources: Table<KnowledgeSource>;
      knowledge_documents: Table<KnowledgeDocument>;
      knowledge_chunks: Table<KnowledgeChunk>;
      assistant_sources: Table<AssistantSource>;
      widget_configs: Table<WidgetConfig>;
      conversations: Table<Conversation>;
      messages: Table<Message>;
      platform_settings: Table<PlatformSetting>;
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_chunks: {
        Args: {
          query_embedding: number[];
          match_source_ids: string[];
          match_count?: number;
        };
        Returns: MatchedChunk[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
