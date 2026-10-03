export const CHUNK_CONFIG = {
  maxChars: 900,
  overlapChars: 120,
  embeddingModel: "text-embedding-3-small" as const,
  embeddingDimensions: 1536,
  /** Chunks returned to the LLM after reranking */
  retrievalCount: 6,
  /** Vector candidates before authority/product rerank */
  retrievalCandidateCount: 24,
  similarityThreshold: 0.14,
  maxChunksPerDocument: 2,
};

export type TextChunkSegment = {
  content: string;
  pageFrom: number | null;
  pageTo: number | null;
};

const PAGE_MARKER_RE = /^---\s*Pagina\s+(\d+)\s*---\s*$/im;

type PageSection = { page: number; body: string };

function splitByPageMarkers(text: string): PageSection[] | null {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const sections: PageSection[] = [];
  let currentPage: number | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentPage === null) return;
    const body = buffer.join("\n").trim();
    if (body) sections.push({ page: currentPage, body });
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(/^---\s*Pagina\s+(\d+)\s*---\s*$/i);
    if (match) {
      flush();
      currentPage = Number(match[1]);
      continue;
    }
    if (currentPage !== null) buffer.push(line);
  }
  flush();

  if (sections.length === 0) return null;
  return sections;
}

function splitSectionIntoChunks(body: string): string[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const { maxChars, overlapChars } = CHUNK_CONFIG;
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const articleBreak = slice.search(/\n(?:Artikel|Art\.|§|Hoofdstuk|\d+\.\d+)\s/m);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
        articleBreak > 0 ? articleBreak : -1,
      );
      if (breakAt > maxChars * 0.35) {
        end = start + breakAt + 1;
      }
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

/** Legacy flat chunk list (no page metadata). */
export function splitTextIntoChunks(text: string): string[] {
  return splitTextIntoChunkSegments(text).map((s) => s.content);
}

export function splitTextIntoChunkSegments(text: string): TextChunkSegment[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const pageSections = splitByPageMarkers(normalized);
  if (pageSections) {
    const segments: TextChunkSegment[] = [];
    for (const section of pageSections) {
      const parts = splitSectionIntoChunks(section.body);
      for (const content of parts) {
        segments.push({
          content,
          pageFrom: section.page,
          pageTo: section.page,
        });
      }
    }
    return segments;
  }

  return splitSectionIntoChunks(normalized).map((content) => ({
    content,
    pageFrom: null,
    pageTo: null,
  }));
}

/** Detect page marker lines (for tests / diagnostics). */
export function isPageMarkerLine(line: string): boolean {
  return PAGE_MARKER_RE.test(line.trim());
}
