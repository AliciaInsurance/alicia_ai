export const CHUNK_CONFIG = {
  maxChars: 900,
  overlapChars: 120,
  embeddingModel: "text-embedding-3-small" as const,
  embeddingDimensions: 1536,
  retrievalCount: 6,
  similarityThreshold: 0.2,
};

export function splitTextIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const { maxChars, overlapChars } = CHUNK_CONFIG;
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const breakAt = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
      if (breakAt > maxChars * 0.4) {
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
