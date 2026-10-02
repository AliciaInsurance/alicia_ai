import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK_RULES = [
  "Answer using approved knowledge for Alicia/product-specific questions.",
  "Never invent policy coverage, exclusions, pricing, acceptance criteria or claims outcomes.",
  "Clearly say when available knowledge is insufficient.",
  "Distinguish general guidance from product-specific facts.",
  "Never pretend to be a human employee.",
  "Do not make automated insurance decisions.",
  "Do not ask for special-category personal data.",
  "Keep answers concise and customer friendly.",
  "Use Dutch by default; reply in English when the customer writes in English.",
];

export async function getPlatformInsuranceRules(): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "insurance_behaviour")
      .maybeSingle();

    const rules = (data?.value as { rules?: string[] } | undefined)?.rules;
    if (Array.isArray(rules) && rules.length > 0) return rules;
  } catch {
    // DB unavailable during build — use defaults
  }
  return FALLBACK_RULES;
}

export function buildGroundedContext(chunks: { id: string; content: string }[]): string {
  if (chunks.length === 0) {
    return "Geen relevante kennisfragmenten gevonden voor deze vraag.";
  }

  return chunks
    .map(
      (c, i) =>
        `[Bron ${i + 1} | chunk_id=${c.id}]\n${c.content}`
    )
    .join("\n\n---\n\n");
}
