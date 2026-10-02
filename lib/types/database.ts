export type AssistantStatus = "draft" | "active" | "inactive";
export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";
export type DocumentSourceType = "manual" | "pdf" | "text" | "markdown" | "url";
export type MessageRole = "user" | "assistant" | "system";
export type ConversationChannel = "widget" | "admin_test";

export interface Assistant {
  id: string;
  internal_name: string;
  slug: string;
  status: AssistantStatus;
  customer_display_name: string;
  model: string;
  system_instructions: string;
  greeting: string;
  fallback_message: string;
  personality_instructions: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  knowledge_source_id: string;
  title: string;
  filename: string | null;
  mime_type: string | null;
  source_type: DocumentSourceType;
  status: DocumentStatus;
  content_hash: string | null;
  raw_text: string | null;
  storage_path: string | null;
  source_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WidgetConfig {
  id: string;
  assistant_id: string;
  public_slug: string;
  is_enabled: boolean;
  position: string;
  primary_color: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  assistant_id: string;
  widget_config_id: string | null;
  anonymous_session_id: string;
  referrer_url: string | null;
  referrer_domain: string | null;
  channel: ConversationChannel;
  started_at: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MatchedChunk {
  id: string;
  document_id: string;
  knowledge_source_id: string;
  content: string;
  similarity: number;
}
