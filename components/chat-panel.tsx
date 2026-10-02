"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

type ChatMessage = { role: "user" | "assistant"; content: string };

interface ChatPanelProps {
  assistantSlug: string;
  channel: "widget" | "admin_test";
  displayName?: string;
  greeting?: string;
  primaryColor?: string;
  showDevErrors?: boolean;
  /** Parent page URL when loaded inside the widget iframe (not ask.alicia.insure). */
  embedReferrerUrl?: string;
}

const SESSION_KEY = "alicia_ai_session_id";
const CONVERSATION_PREFIX = "alicia_ai_conversation_";

export function ChatPanel({
  assistantSlug,
  channel,
  displayName = "Alicia",
  greeting,
  primaryColor = "#0f766e",
  showDevErrors = false,
  embedReferrerUrl,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(`${CONVERSATION_PREFIX}${assistantSlug}`);
    if (stored) setConversationId(stored);
  }, [assistantSlug]);

  useEffect(() => {
    if (greeting && messages.length === 0) {
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [greeting, messages.length]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistant: assistantSlug,
          message: text,
          sessionId,
          conversationId,
          channel,
          referrerUrl:
            channel === "widget"
              ? embedReferrerUrl
              : typeof window !== "undefined"
                ? window.location.href
                : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      setConversationId(data.conversationId);
      localStorage.setItem(`${CONVERSATION_PREFIX}${assistantSlug}`, data.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      if (showDevErrors) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${message}` },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [
    assistantSlug,
    channel,
    conversationId,
    embedReferrerUrl,
    input,
    loading,
    sessionId,
    showDevErrors,
  ]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
      <header
        className="border-b border-slate-100 px-4 py-3"
        style={{ borderTopColor: primaryColor }}
      >
        <div className="font-medium text-slate-900">{displayName}</div>
        <div className="text-xs text-slate-500">AI-assistent · geen medewerker</div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-slate-100 text-slate-900"
                : "mr-auto bg-teal-50 text-slate-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="text-xs text-slate-500">Alicia typt…</div>
        )}
      </div>

      {error && !showDevErrors && (
        <div className="px-4 text-xs text-red-600">{error}</div>
      )}

      <div className="border-t border-slate-100 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Stel je vraag…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: primaryColor }}
          >
            Verstuur
          </button>
        </form>
      </div>
    </div>
  );
}
