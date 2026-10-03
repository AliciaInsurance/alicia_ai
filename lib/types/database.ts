export type AssistantStatus = "draft" | "active" | "inactive";

export type KnowledgeItemStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "unsupported";

export type KnowledgeType = "manual_text" | "document" | "web" | "structured_data";

/** Legacy/file column — must match DB source_type_check */
export type KnowledgeSourceType =
  | "manual"
  | "pdf"
  | "text"
  | "markdown"
  | "url"
  | "csv"
  | "json";

export type KnowledgeReviewStatus = "draft" | "pending_review" | "approved" | "rejected";

export type MessageRole = "user" | "assistant" | "system";
export type ConversationChannel = "widget" | "admin_test";

export type AssistantType = "public_sales" | "public_service" | "internal_copilot";

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
  assistant_type: AssistantType;
  purpose: string;
  audience: string;
  channel_context: string;
  allowed_products: string[];
  partner: string | null;
  default_product: string | null;
  goals: string;
  restrictions: string;
  understanding_model: string;
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

/** Row in knowledge_documents — a knowledge item within a source. */
export interface KnowledgeItem {
  id: string;
  knowledge_source_id: string;
  title: string;
  knowledge_type: KnowledgeType;
  status: KnowledgeItemStatus;
  review_status: KnowledgeReviewStatus;
  category: string | null;
  owner: string | null;
  version_label: string | null;
  product: string | null;
  document_type: string | null;
  /** 1 = highest authority (voorwaarden), 100 = lowest; used in retrieval reranking */
  authority_rank: number;
  /** Document applies to all products (e.g. general Alicia info). */
  product_neutral?: boolean;
  valid_from: string | null;
  valid_until: string | null;
  filename: string | null;
  mime_type: string | null;
  content_type: string | null;
  source_url: string | null;
  fetched_at: string | null;
  last_refresh_at: string | null;
  content_hash: string | null;
  raw_text: string | null;
  structured_data: StructuredDataPayload | null;
  storage_path: string | null;
  error_message: string | null;
  source_type: KnowledgeSourceType | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use KnowledgeItem */
export type KnowledgeDocument = KnowledgeItem;

export type StructuredDataPayload = {
  format: "csv" | "json";
  headers: string[];
  rows: Record<string, string>[];
};

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
  conversation_state: Record<string, unknown>;
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
  page_from: number | null;
  page_to: number | null;
  chunk_product?: string | null;
  product_neutral?: boolean;
}

export interface RetrievedKnowledgeRef {
  document_id: string;
  page_from: number | null;
  page_to: number | null;
}
