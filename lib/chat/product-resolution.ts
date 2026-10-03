import type { Assistant } from "@/lib/types/database";
import {
  detectProductsInMessage,
  getSingleScopedProduct,
  isProductAllowed,
  normalizeProductCode,
} from "@/lib/chat/assistant-context";
import type { ConversationState } from "@/lib/chat/conversation-state";

export type ProductResolution = {
  product: string | null;
  source:
    | "message"
    | "conversation_state"
    | "assistant_scope"
    | "assistant_default"
    | "understanding"
    | "unresolved";
};

export function resolveProduct(params: {
  assistant: Assistant;
  latestUserMessage: string;
  state: ConversationState;
  understandingProduct: string | null;
  referrerUrl?: string | null;
}): ProductResolution {
  const { assistant, latestUserMessage, state, understandingProduct } = params;

  const fromMessage = detectProductsInMessage(latestUserMessage);
  if (fromMessage.length === 1) {
    const p = fromMessage[0];
    if (isProductAllowed(assistant, p)) {
      return { product: p, source: "message" };
    }
  }
  if (fromMessage.length > 1) {
    return { product: null, source: "unresolved" };
  }

  const stateProduct = normalizeProductCode(state.product ?? null);
  if (stateProduct && isProductAllowed(assistant, stateProduct)) {
    return { product: stateProduct, source: "conversation_state" };
  }

  const scoped = getSingleScopedProduct(assistant);
  if (scoped && isProductAllowed(assistant, scoped)) {
    return { product: scoped, source: "assistant_scope" };
  }

  const defaultProduct = normalizeProductCode(assistant.default_product);
  if (defaultProduct && isProductAllowed(assistant, defaultProduct)) {
    return { product: defaultProduct, source: "assistant_default" };
  }

  const fromUnderstanding = normalizeProductCode(understandingProduct);
  if (fromUnderstanding && isProductAllowed(assistant, fromUnderstanding)) {
    return { product: fromUnderstanding, source: "understanding" };
  }

  // Referrer hints (lightweight, no hardcoded trees)
  const ref = (params.referrerUrl ?? "").toLowerCase();
  if (ref) {
    for (const code of detectProductsInMessage(ref)) {
      if (isProductAllowed(assistant, code)) {
        return { product: code, source: "message" };
      }
    }
  }

  return { product: null, source: "unresolved" };
}

export function assistantRequiresProductForGrounding(assistant: Assistant): boolean {
  const allowed = assistant.allowed_products ?? [];
  return allowed.length !== 1 && !assistant.default_product;
}
