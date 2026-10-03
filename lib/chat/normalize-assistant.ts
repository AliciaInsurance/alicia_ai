import type { Assistant, AssistantType } from "@/lib/types/database";

const ASSISTANT_TYPES: AssistantType[] = [
  "public_sales",
  "public_service",
  "internal_copilot",
];

export function normalizeAssistantRow(row: Record<string, unknown>): Assistant {
  const assistantType = String(row.assistant_type ?? "public_sales");
  return {
    id: String(row.id),
    internal_name: String(row.internal_name ?? ""),
    slug: String(row.slug ?? ""),
    status: row.status as Assistant["status"],
    customer_display_name: String(row.customer_display_name ?? "Alicia"),
    model: String(row.model ?? "gpt-4o-mini"),
    system_instructions: String(row.system_instructions ?? ""),
    greeting: String(row.greeting ?? ""),
    fallback_message: String(row.fallback_message ?? ""),
    personality_instructions: String(row.personality_instructions ?? ""),
    assistant_type: ASSISTANT_TYPES.includes(assistantType as AssistantType)
      ? (assistantType as AssistantType)
      : "public_sales",
    purpose: String(row.purpose ?? ""),
    audience: String(row.audience ?? ""),
    channel_context: String(row.channel_context ?? ""),
    allowed_products: Array.isArray(row.allowed_products)
      ? row.allowed_products.map((p) => String(p))
      : [],
    partner: row.partner != null ? String(row.partner) : null,
    default_product: row.default_product != null ? String(row.default_product) : null,
    goals: String(row.goals ?? ""),
    restrictions: String(row.restrictions ?? ""),
    understanding_model: String(row.understanding_model ?? "gpt-4o-mini"),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}
