import type { Message } from "@/lib/types/database";

export type ConversationTurnSplit = {
  /** User/assistant messages before the current user turn. */
  priorHistory: Message[];
  /** Current user message (not included in priorHistory). */
  currentUserMessage: string;
};

/**
 * Split loaded history so the latest user message is not duplicated in prompts.
 * Assumes history includes the message just inserted for this turn.
 */
export function splitConversationTurn(
  messages: Message[],
  fallbackCurrentMessage: string,
): ConversationTurnSplit {
  const conversational = messages.filter((m) => m.role === "user" || m.role === "assistant");

  if (conversational.length === 0) {
    return { priorHistory: [], currentUserMessage: fallbackCurrentMessage };
  }

  const last = conversational[conversational.length - 1]!;
  if (last.role === "user" && last.content.trim() === fallbackCurrentMessage.trim()) {
    return {
      priorHistory: conversational.slice(0, -1),
      currentUserMessage: fallbackCurrentMessage,
    };
  }

  return {
    priorHistory: conversational,
    currentUserMessage: fallbackCurrentMessage,
  };
}
