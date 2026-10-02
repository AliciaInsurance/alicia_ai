import { lookup } from "dns/promises";
import { isIP } from "net";
import { MAX_KNOWLEDGE_FILE_BYTES } from "@/lib/knowledge/constants";
import { extractDocumentBuffer } from "@/lib/knowledge/extract-document";

const FETCH_TIMEOUT_MS = 45_000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "127.0.0.1",
  "0.0.0.0",
]);

export type WebFetchKind = "html" | "document" | "text" | "unsupported";

export type FetchedWebContent = {
  kind: WebFetchKind;
  text: string;
  title: string;
  contentType: string | null;
  resolvedUrl: string;
  unsupportedMessage?: string;
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
};

export function resolveFetchTarget(inputUrl: URL): ResolvedFetchTarget {
  const host = inputUrl.hostname.toLowerCase();
  const path = inputUrl.pathname;

  const docMatch = path.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (host.endsWith("docs.google.com") && docMatch) {
    return {
      fetchUrl: `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`,
      titleHint: "Google Doc",
    };
  }

  const sheetMatch = path.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (host.endsWith("docs.google.com") && sheetMatch) {
    return {
      fetchUrl: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`,
      titleHint: "Google Sheet",
    };
  }

  const driveFileMatch = path.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (host.endsWith("drive.google.com") && driveFileMatch) {
    return {
      fetchUrl: `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`,
      titleHint: "Google Drive-bestand",
    };
  }

  return { fetchUrl: inputUrl.toString(), titleHint: inputUrl.hostname };
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

async function readResponseBody(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > MAX_KNOWLEDGE_FILE_BYTES) {
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
    if (total > MAX_KNOWLEDGE_FILE_BYTES) {
      throw new Error("Antwoord is groter dan 8MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchWebContent(rawUrl: string): Promise<FetchedWebContent> {
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
        Accept: "text/html,application/pdf,text/plain,text/markdown,text/csv,*/*",
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

    const contentType = response.headers.get("content-type");
    const buffer = await readResponseBody(response);
    if (buffer.length === 0) {
      throw new Error("Lege inhoud ontvangen van URL");
    }

    const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
    const isPdfFile =
      buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
    let title = target.titleHint;

    if (isPdfFile || mime === "application/pdf") {
      const extracted = await extractDocumentBuffer(buffer, "pdf");
      if (!extracted.ok) {
        return {
          kind: "unsupported",
          text: "",
          title,
          contentType,
          resolvedUrl: fetchUrlParsed.toString(),
          unsupportedMessage: extracted.message,
        };
      }
      return {
        kind: "document",
        text: extracted.text,
        title,
        contentType: contentType ?? "application/pdf",
        resolvedUrl: fetchUrlParsed.toString(),
      };
    }

    if (mime.includes("text/html") || mime === "") {
      const html = buffer.toString("utf8");
      if (/accounts\.google\.com|ServiceLogin|signin/i.test(html)) {
        throw new Error(
          "Google vraagt om inloggen. Deel het document publiek (iedereen met de link) en probeer opnieuw.",
        );
      }
      const text = htmlToPlainText(html);
      title = titleFromHtml(html, title);
      if (!text) throw new Error("Geen leesbare tekst op deze webpagina.");
      return {
        kind: "html",
        text,
        title,
        contentType,
        resolvedUrl: fetchUrlParsed.toString(),
      };
    }

    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "text/csv" ||
      fetchUrlParsed.pathname.toLowerCase().endsWith(".md")
    ) {
      const text = buffer.toString("utf8").trim();
      if (!text) throw new Error("Geen tekst uit URL gehaald.");
      return {
        kind: "text",
        text,
        title,
        contentType,
        resolvedUrl: fetchUrlParsed.toString(),
      };
    }

    return {
      kind: "unsupported",
      text: "",
      title,
      contentType,
      resolvedUrl: fetchUrlParsed.toString(),
      unsupportedMessage: `Content-Type niet ondersteund: ${mime || "onbekend"}`,
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
