import { decideClarification } from "@/lib/chat/clarification";
import { splitConversationTurn } from "@/lib/chat/conversation-turn";
import {
  clearClarificationLifecycle,
  mergeConversationState,
  nextClarificationAttemptCount,
  parseConversationState,
  type ConversationState,
} from "@/lib/chat/conversation-state";
import { resolveProduct } from "@/lib/chat/product-resolution";
import { resolveActiveAssistant } from "@/lib/chat/resolve-assistant";
import { synthesizeAnswer, synthesizeClarification } from "@/lib/chat/synthesis";
import {
  runConversationUnderstanding,
  type ConversationUnderstanding,
} from "@/lib/chat/understanding";
import { retrieveRelevantKnowledge } from "@/lib/knowledge/retrieve";
import { log } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Assistant,
  Conversation,
  ConversationChannel,
  Message,
} from "@/lib/types/database";

export interface ChatRequestInput {
  assistantSlug: string;
  message: string;
  anonymousSessionId: string;
  conversationId?: string;
  channel: ConversationChannel;
  referrerUrl?: string;
  referrerDomain?: string;
}

export interface ChatResult {
  conversationId: string;
  reply: string;
  messageId: string;
}

async function getOrCreateConversation(
  assistant: Assistant,
  input: ChatRequestInput,
): Promise<Conversation> {
  const supabase = createAdminClient();

  if (input.conversationId) {
    const { data: existingRow } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", input.conversationId)
      .eq("assistant_id", assistant.id)
      .maybeSingle();
    const existing = existingRow as Conversation | null;
    if (
      existing &&
      existing.anonymous_session_id === input.anonymousSessionId &&
      existing.channel === input.channel
    ) {
      return existing;
    }
  }

  let widgetConfigId: string | null = null;
  if (input.channel === "widget") {
    const { data: widget } = await supabase
      .from("widget_configs")
      .select("id, is_enabled")
      .eq("assistant_id", assistant.id)
      .maybeSingle();
    if (!widget?.is_enabled) throw new Error("Widget is not enabled");
    widgetConfigId = widget.id as string;
  }

  const { data: createdRow, error } = await supabase
    .from("conversations")
    .insert({
      assistant_id: assistant.id,
      widget_config_id: widgetConfigId,
      anonymous_session_id: input.anonymousSessionId,
      referrer_url: input.referrerUrl ?? null,
      referrer_domain: input.referrerDomain ?? null,
      channel: input.channel,
      conversation_state: {},
    })
    .select("*")
    .single();

  const data = createdRow as Conversation | null;

  if (error || !data) throw new Error(error?.message ?? "Could not create conversation");
  return data;
}

async function loadRecentMessages(conversationId: string): Promise<Message[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  return (data ?? []) as Message[];
}

function buildSearchQueries(params: {
  understandingQueries: string[];
  product: string | null;
  intent: string | null;
  topic: string | null;
  latestUserMessage: string;
}): string[] {
  const fromUnderstanding = params.understandingQueries.map((q) => q.trim()).filter(Boolean);
  if (fromUnderstanding.length > 0) return fromUnderstanding.slice(0, 3);

  if (!params.product) return [];

  const topic = params.topic ?? params.intent ?? params.latestUserMessage;
  const base = `${params.product} ${topic}`.trim();
  return [base, `${params.product} polisvoorwaarden ${topic}`].slice(0, 2);
}

function buildStateUpdate(params: {
  priorState: ConversationState;
  understanding: ConversationUnderstanding;
  resolvedProduct: string | null;
  clarificationQuestion: string | null;
}): Partial<ConversationState> {
  const u = params.understanding;

  if (params.resolvedProduct) {
    return {
      intent: u.intent,
      product: params.resolvedProduct,
      topic: u.topic,
      profession: u.profession ?? undefined,
      customer_type: u.customer_type ?? undefined,
      known_facts: u.known_facts_update,
      ...clearClarificationLifecycle(),
    };
  }

  if (params.clarificationQuestion) {
    const attempts = nextClarificationAttemptCount(
      params.priorState,
      params.clarificationQuestion,
    );
    return {
      intent: u.intent,
      product: u.product,
      topic: u.topic,
      profession: u.profession ?? undefined,
      customer_type: u.customer_type ?? undefined,
      known_facts: u.known_facts_update,
      open_question: params.clarificationQuestion,
      last_clarification: params.clarificationQuestion,
      clarification_attempts: attempts,
    };
  }

  return {
    intent: u.intent,
    product: u.product,
    topic: u.topic,
    profession: u.profession ?? undefined,
    customer_type: u.customer_type ?? undefined,
    known_facts: u.known_facts_update,
    open_question: null,
    last_clarification: null,
    clarification_attempts: 0,
  };
}

export async function runChat(input: ChatRequestInput): Promise<ChatResult> {
  const started = Date.now();
  const assistant = await resolveActiveAssistant(input.assistantSlug);
  const conversation = await getOrCreateConversation(assistant, input);
  const supabase = createAdminClient();

  const trimmed = input.message.trim();
  if (!trimmed) throw new Error("Message is required");

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: trimmed,
  });

  const history = await loadRecentMessages(conversation.id);
  const { priorHistory, currentUserMessage } = splitConversationTurn(history, trimmed);
  const priorState = parseConversationState(conversation.conversation_state);

  const preliminaryProduct = resolveProduct({
    assistant,
    latestUserMessage: trimmed,
    state: priorState,
    understandingProduct: null,
    referrerUrl: input.referrerUrl ?? conversation.referrer_url,
  });

  const understandingResult = await runConversationUnderstanding({
    assistant,
    state: priorState,
    priorHistory,
    latestUserMessage: currentUserMessage,
    referrerUrl: input.referrerUrl ?? conversation.referrer_url,
    referrerDomain: input.referrerDomain ?? conversation.referrer_domain,
    resolvedProduct: preliminaryProduct.product,
  });

  const productResolution = resolveProduct({
    assistant,
    latestUserMessage: trimmed,
    state: priorState,
    understandingProduct: understandingResult.understanding.product,
    referrerUrl: input.referrerUrl ?? conversation.referrer_url,
  });

  const resolvedProduct = productResolution.product;
  const searchQueries = buildSearchQueries({
    understandingQueries: understandingResult.understanding.search_queries,
    product: resolvedProduct,
    intent: understandingResult.understanding.intent,
    topic: understandingResult.understanding.topic,
    latestUserMessage: trimmed,
  });

  const clarification = decideClarification({
    assistant,
    state: priorState,
    understanding: understandingResult.understanding,
    resolvedProduct,
    searchQueries,
  });

  let reply: string;
  let chunks: Awaited<ReturnType<typeof retrieveRelevantKnowledge>> = [];
  let synthesisModel = assistant.model;
  let synthesisUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  let synthesisLatencyMs = 0;
  let clarificationOccurred = false;

  const mustNotRetrieve = clarification.blocksPolicyRetrieval;

  if (clarification.required && clarification.question) {
    clarificationOccurred = true;
    reply = await synthesizeClarification({
      assistant,
      clarifyingQuestion: clarification.question,
    });
  } else {
    const retrievalStarted = Date.now();
    chunks =
      searchQueries.length > 0
        ? await retrieveRelevantKnowledge({
            assistantId: assistant.id,
            product: resolvedProduct,
            topic: understandingResult.understanding.topic,
            intent: understandingResult.understanding.intent,
            searchQueries,
          })
        : [];

    const synthesis = await synthesizeAnswer({
      assistant,
      state: priorState,
      understanding: understandingResult.understanding,
      resolvedProduct,
      priorHistory,
      latestUserMessage: currentUserMessage,
      chunks,
      fallbackMessage: assistant.fallback_message,
    });
    reply = synthesis.reply;
    synthesisModel = synthesis.model;
    synthesisUsage = synthesis.usage;
    synthesisLatencyMs = synthesis.latencyMs;

    log.info("chat_synthesis", {
      assistantId: assistant.id,
      retrievalMs: Date.now() - retrievalStarted - synthesisLatencyMs,
      chunkCount: chunks.length,
    });
  }

  const nextState = mergeConversationState(
    priorState,
    buildStateUpdate({
      priorState,
      understanding: understandingResult.understanding,
      resolvedProduct,
      clarificationQuestion:
        clarificationOccurred && clarification.question ? clarification.question : null,
    }),
  );

  await supabase
    .from("conversations")
    .update({
      conversation_state: nextState,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversation.id);

  const metadata = {
    orchestration: "conversation_first_v1",
    intent: understandingResult.understanding.intent,
    topic: understandingResult.understanding.topic,
    resolved_product: resolvedProduct,
    product_resolution_source: productResolution.source,
    clarification: clarificationOccurred,
    clarification_reason: clarification.reason,
    search_queries: searchQueries,
    blocks_policy_retrieval: mustNotRetrieve,
    retrieved_knowledge: chunks.map((c) => ({
      document_id: c.document_id,
      document_title: c.document_title,
      product: c.product,
      chunk_product: c.chunk_product,
      effective_product: c.effective_product,
      product_neutral: c.product_neutral,
      product_eligibility: c.product_eligibility,
      authority_rank: c.authority_rank,
      page_from: c.page_from,
      page_to: c.page_to,
      rerank_score: c.rerank_score,
    })),
    understanding_model: understandingResult.model,
    understanding_tokens: understandingResult.usage,
    understanding_latency_ms: understandingResult.latencyMs,
    answer_model: synthesisModel,
    answer_tokens: synthesisUsage,
    answer_latency_ms: synthesisLatencyMs,
    total_latency_ms: Date.now() - started,
  };

  const { data: saved, error: saveError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
      model: clarificationOccurred ? understandingResult.model : synthesisModel,
      metadata,
    })
    .select("id")
    .single();

  if (saveError) throw new Error(saveError.message);

  log.info("chat_completed", {
    assistantId: assistant.id,
    conversationId: conversation.id,
    channel: input.channel,
    clarification: clarificationOccurred,
    chunkCount: chunks.length,
    latencyMs: Date.now() - started,
  });

  return {
    conversationId: conversation.id,
    reply,
    messageId: saved.id as string,
  };
}
