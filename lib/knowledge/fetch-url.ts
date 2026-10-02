import { lookup } from "dns/promises";
import { isIP } from "net";
import type { DocumentSourceType } from "@/lib/types/database";
import { extractTextFromBuffer } from "@/lib/knowledge/extract";

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 45_000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "127.0.0.1",
  "0.0.0.0",
]);

export type FetchedUrlContent = {
  text: string;
  title: string;
  mimeType: string | null;
  sourceType: DocumentSourceType;
  resolvedUrl: string;
};

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIpv4(ip);
  if (kind === 6) return isPrivateIpv6(ip);
  return true;
}

export async function assertSafeFetchUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Ongeldige URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Alleen http- en https-URL's zijn toegestaan");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("Deze host is niet toegestaan");
  }

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("Interne IP-adressen zijn niet toegestaan");
    }
    return parsed;
  }

  const records = await lookup(hostname, { all: true });
  if (!records.length) {
    throw new Error("Host kon niet worden opgezocht");
  }
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error("Deze URL wijst naar een intern netwerkadres");
    }
  }

  return parsed;
}

type ResolvedFetchTarget = {
  fetchUrl: string;
  titleHint: string;
  sourceTypeHint: DocumentSourceType;
};

export function resolveFetchTarget(inputUrl: URL): ResolvedFetchTarget {
  const host = inputUrl.hostname.toLowerCase();
  const path = inputUrl.pathname;

  const docMatch = path.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (host.endsWith("docs.google.com") && docMatch) {
    const id = docMatch[1];
    return {
      fetchUrl: `https://docs.google.com/document/d/${id}/export?format=txt`,
      titleHint: "Google Doc",
      sourceTypeHint: "text",
    };
  }

  const sheetMatch = path.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (host.endsWith("docs.google.com") && sheetMatch) {
    const id = sheetMatch[1];
    return {
      fetchUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
      titleHint: "Google Sheet",
      sourceTypeHint: "text",
    };
  }

  const driveFileMatch = path.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (host.endsWith("drive.google.com") && driveFileMatch) {
    const id = driveFileMatch[1];
    return {
      fetchUrl: `https://drive.google.com/uc?export=download&id=${id}`,
      titleHint: "Google Drive-bestand",
      sourceTypeHint: "pdf",
    };
  }

  const lowerPath = path.toLowerCase();
  let sourceTypeHint: DocumentSourceType = "text";
  if (lowerPath.endsWith(".pdf")) sourceTypeHint = "pdf";
  else if (lowerPath.endsWith(".md")) sourceTypeHint = "markdown";
  else if (lowerPath.endsWith(".txt")) sourceTypeHint = "text";

  return {
    fetchUrl: inputUrl.toString(),
    titleHint: inputUrl.hostname,
    sourceTypeHint,
  };
}

function htmlToPlainText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withBreaks = withoutScripts
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  return stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function titleFromHtml(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return fallback;
  return match[1].replace(/\s+/g, " ").trim().slice(0, 200) || fallback;
}

function detectSourceTypeFromMime(
  mimeType: string | null,
  hint: DocumentSourceType,
): DocumentSourceType {
  if (!mimeType) return hint;
  const lower = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (lower === "application/pdf") return "pdf";
  if (lower === "text/markdown") return "markdown";
  if (lower.startsWith("text/")) return "text";
  if (lower === "application/json") return "text";
  return hint;
}

async function readResponseBody(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      throw new Error("Antwoord is groter dan 8MB");
    }
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > MAX_BYTES) {
      throw new Error("Antwoord is groter dan 8MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchUrlContent(rawUrl: string): Promise<FetchedUrlContent> {
  const inputUrl = await assertSafeFetchUrl(rawUrl);
  const target = resolveFetchTarget(inputUrl);
  const fetchUrlParsed = await assertSafeFetchUrl(target.fetchUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(fetchUrlParsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/pdf,text/plain,text/markdown,*/*",
        "User-Agent": "Alicia-Knowledge-Ingest/1.0",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Geen toegang tot deze URL. Zorg dat het document publiek is (iedereen met de link).",
        );
      }
      throw new Error(`Download mislukt (HTTP ${response.status})`);
    }

    const mimeType = response.headers.get("content-type");
    const buffer = await readResponseBody(response);
    if (buffer.length === 0) {
      throw new Error("Lege inhoud ontvangen van URL");
    }

    const sourceType = detectSourceTypeFromMime(mimeType, target.sourceTypeHint);
    let text: string;
    let title = target.titleHint;

    if (sourceType === "pdf") {
      text = await extractTextFromBuffer(buffer, "pdf");
    } else if (mimeType?.toLowerCase().includes("text/html")) {
      const html = buffer.toString("utf8");
      if (/accounts\.google\.com|ServiceLogin|signin/i.test(html)) {
        throw new Error(
          "Google vraagt om inloggen. Deel het document publiek (iedereen met de link) en probeer opnieuw.",
        );
      }
      text = htmlToPlainText(html);
      title = titleFromHtml(html, title);
    } else {
      text = buffer.toString("utf8").trim();
    }

    if (!text.trim()) {
      throw new Error("Geen tekst uit deze URL gehaald");
    }

    return {
      text: text.trim(),
      title,
      mimeType,
      sourceType: sourceType === "pdf" || sourceType === "markdown" ? sourceType : "url",
      resolvedUrl: fetchUrlParsed.toString(),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timeout bij ophalen van URL");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
