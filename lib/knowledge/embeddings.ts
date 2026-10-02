import OpenAI from "openai";
import { getOpenAIApiKey } from "@/lib/env";
import { CHUNK_CONFIG } from "@/lib/knowledge/chunking";

let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: getOpenAIApiKey() });
  }
  return openai;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getOpenAI();
  const response = await client.embeddings.create({
    model: CHUNK_CONFIG.embeddingModel,
    input: texts,
    dimensions: CHUNK_CONFIG.embeddingDimensions,
  });
  return response.data.map((d) => d.embedding);
}
