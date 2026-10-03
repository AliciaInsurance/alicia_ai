import type { Assistant } from "@/lib/types/database";
import { detectProductsInText, productFromDocumentField } from "@/lib/knowledge/authority";

export type AssistantType = "public_sales" | "public_service" | "internal_copilot";

export function normalizeProductCode(value: string | null | undefined): string | null {
  const hint = productFromDocumentField(value ?? null);
  if (hint === "UNKNOWN") {
    const trimmed = (value ?? "").trim().toUpperCase();
    return trimmed || null;
  }
  return hint;
}

export function getAllowedProducts(assistant: Assistant): string[] {
  const codes = (assistant.allowed_products ?? [])
    .map((p) => normalizeProductCode(p))
    .filter((p): p is string => Boolean(p));
  return [...new Set(codes)];
}

export function getSingleScopedProduct(assistant: Assistant): string | null {
  const allowed = getAllowedProducts(assistant);
  if (allowed.length === 1) return allowed[0];
  const def = normalizeProductCode(assistant.default_product);
  if (def && allowed.length > 0 && !allowed.includes(def)) return null;
  if (def && allowed.length === 0) return def;
  return null;
}

export function isProductAllowed(assistant: Assistant, product: string | null): boolean {
  if (!product) return false;
  const allowed = getAllowedProducts(assistant);
  if (allowed.length === 0) return true;
  return allowed.includes(product);
}

export function detectProductsInMessage(text: string): string[] {
  return detectProductsInText(text);
}

export function formatAssistantContextForPrompt(assistant: Assistant): string {
  const allowed = getAllowedProducts(assistant);
  const lines = [
    `Type: ${assistant.assistant_type}`,
    assistant.purpose ? `Doel: ${assistant.purpose}` : null,
    assistant.audience ? `Doelgroep: ${assistant.audience}` : null,
    assistant.partner ? `Partner/context: ${assistant.partner}` : null,
    assistant.channel_context ? `Kanaal/funnel: ${assistant.channel_context}` : null,
    allowed.length ? `Producten in scope: ${allowed.join(", ")}` : "Producten in scope: alle gekoppelde producten",
    assistant.default_product
      ? `Standaardproduct (indien van toepassing): ${assistant.default_product}`
      : null,
    assistant.goals ? `Doelen: ${assistant.goals}` : null,
    assistant.restrictions ? `Beperkingen: ${assistant.restrictions}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}
