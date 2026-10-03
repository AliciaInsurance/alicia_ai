import OpenAI from "openai";
import { resolveActiveAssistant } from "@/lib/chat/resolve-assistant";
import { getOpenAIApiKey } from "@/lib/env";
import { retrieveRelevantChunks } from "@/lib/knowledge/retrieve";
import { buildGroundedContext, getPlatformInsuranceRules } from "@/lib/platform/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import type {
  Assistant,
  Conversation,
  ConversationChannel,
  Message,
} from "@/lib/types/database";

let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: getOpenAIApiKey() });
  return openai;
}

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
  input: ChatRequestInput
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

function detectEnglish(text: string): boolean {
  const lower = text.toLowerCase();
  const englishHints = ["what", "how", "can you", "please", "insurance", "hello", "hi "];
  return englishHints.some((h) => lower.includes(h));
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
  const chunks = await retrieveRelevantChunks(assistant.id, trimmed);
  const platformRules = await getPlatformInsuranceRules();
  const grounded = buildGroundedContext(chunks);

  const localeHint = detectEnglish(trimmed)
    ? "The customer appears to be writing in English — reply in English."
    : "Reply in Dutch unless the customer clearly uses another language.";

  const systemParts = [
    `You are ${assistant.customer_display_name}, the customer-facing AI assistant for Alicia (insurance). You are NOT a human employee.`,
    assistant.personality_instructions,
    assistant.system_instructions,
    "Platform insurance behaviour rules:",
    ...platformRules.map((r) => `- ${r}`),
    localeHint,
    `Knowledge hierarchy when sources conflict: polisvoorwaarden / policy conditions (lowest priority number) override IPID, which override FAQ or general summaries. Never let FAQ contradict formal policy text in the snippets.`,
    `Product matching: answer only for the product the customer asks about (e.g. AVB vs BAV vs AOV). Ignore snippets clearly about another product. Do not describe BAV limits when the customer asks about AVB unless the snippet is explicitly AVB.`,
    `Use ONLY the grounded snippets below for concrete coverage, limits, exclusions, cancellation, eigen risico, and policy facts. If snippets do not contain the answer, say so — do not guess.`,
    `If grounded knowledge is insufficient, use this fallback tone (adapt wording naturally): ${assistant.fallback_message}`,
    "Grounded knowledge snippets:",
    grounded,
  ];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemParts.join("\n\n") },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  ];

  const client = getOpenAI();
  const llmStarted = Date.now();
  const completion = await client.chat.completions.create({
    model: assistant.model,
    messages,
    temperature: 0.3,
  });

  const reply =
    completion.choices[0]?.message?.content?.trim() ||
    assistant.fallback_message;

  const metadata = {
    retrieved_knowledge: chunks.map((c) => ({
      document_id: c.document_id,
      page_from: c.page_from,
      page_to: c.page_to,
    })),
    prompt_tokens: completion.usage?.prompt_tokens,
    completion_tokens: completion.usage?.completion_tokens,
    total_tokens: completion.usage?.total_tokens,
    retrieval_latency_ms: llmStarted - started,
    llm_latency_ms: Date.now() - llmStarted,
    total_latency_ms: Date.now() - started,
    model: assistant.model,
  };

  const { data: saved, error: saveError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
      model: assistant.model,
      metadata,
    })
    .select("id")
    .single();

  if (saveError) throw new Error(saveError.message);

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id);

  log.info("chat_completed", {
    assistantId: assistant.id,
    conversationId: conversation.id,
    channel: input.channel,
    chunkCount: chunks.length,
    latencyMs: Date.now() - started,
  });

  return {
    conversationId: conversation.id,
    reply,
    messageId: saved.id as string,
  };
}
