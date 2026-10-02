import { getPublicAppUrl } from "@/lib/env";

export type SanitizedReferrer = {
  referrerUrl: string;
  referrerDomain: string;
};

function blockedReferrerHostnames(): Set<string> {
  const hosts = new Set<string>(["ask.alicia.insure", "localhost", "127.0.0.1"]);
  try {
    hosts.add(new URL(getPublicAppUrl()).hostname.toLowerCase());
  } catch {
    // ignore invalid NEXT_PUBLIC_APP_URL
  }
  return hosts;
}

/** Validates and normalizes the parent page URL for widget embeds (not the iframe URL). */
export function sanitizeEmbedReferrer(
  raw: string | undefined
): SanitizedReferrer | null {
  if (!raw?.trim()) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw.trim().slice(0, 2000));
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (blockedReferrerHostnames().has(hostname)) {
    return null;
  }

  parsed.username = "";
  parsed.password = "";

  return {
    referrerUrl: parsed.toString(),
    referrerDomain: hostname,
  };
}
