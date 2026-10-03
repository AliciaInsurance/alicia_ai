"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssistantStatus, AssistantType } from "@/lib/types/database";

const ASSISTANT_TYPES: AssistantType[] = [
  "public_sales",
  "public_service",
  "internal_copilot",
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createAssistant(formData: FormData) {
  await requireAdminUser();
  const internalName = String(formData.get("internal_name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? internalName));

  if (!internalName || !slug) throw new Error("Name and slug are required");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistants")
    .insert({
      internal_name: internalName,
      slug,
      status: "draft",
      greeting:
        "Hoi, ik ben Alicia, de AI-assistent van Alicia. Waar kan ik je mee helpen?",
      fallback_message:
        "Sorry, daar kan ik je nu niet genoeg over vertellen op basis van onze beschikbare informatie.",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("widget_configs").insert({
    assistant_id: data.id,
    public_slug: slug,
  });

  revalidatePath("/assistants");
  redirect(`/assistants/${data.id}`);
}

export async function updateAssistant(id: string, formData: FormData) {
  await requireAdminUser();
  const supabase = createAdminClient();

  const allowedRaw = String(formData.get("allowed_products") ?? "").trim();
  const allowed_products = allowedRaw
    ? allowedRaw
        .split(/[,;\n]+/)
        .map((p) => p.trim().toUpperCase())
        .filter(Boolean)
    : [];

  const payload = {
    internal_name: String(formData.get("internal_name") ?? "").trim(),
    slug: slugify(String(formData.get("slug") ?? "")),
    status: String(formData.get("status") ?? "draft") as AssistantStatus,
    model: String(formData.get("model") ?? "gpt-4o-mini").trim(),
    greeting: String(formData.get("greeting") ?? "").trim(),
    fallback_message: String(formData.get("fallback_message") ?? "").trim(),
    system_instructions: String(formData.get("system_instructions") ?? ""),
    personality_instructions: String(formData.get("personality_instructions") ?? ""),
    assistant_type: (() => {
      const t = String(formData.get("assistant_type") ?? "public_sales");
      return ASSISTANT_TYPES.includes(t as AssistantType) ? t : "public_sales";
    })(),
    purpose: String(formData.get("purpose") ?? "").trim(),
    audience: String(formData.get("audience") ?? "").trim(),
    channel_context: String(formData.get("channel_context") ?? "").trim(),
    allowed_products,
    partner: String(formData.get("partner") ?? "").trim() || null,
    default_product: String(formData.get("default_product") ?? "").trim().toUpperCase() || null,
    goals: String(formData.get("goals") ?? "").trim(),
    restrictions: String(formData.get("restrictions") ?? "").trim(),
    understanding_model: String(formData.get("understanding_model") ?? "gpt-4o-mini").trim(),
  };

  const { error } = await supabase.from("assistants").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/assistants/${id}`);
  revalidatePath("/assistants");
}

export async function setAssistantStatus(id: string, status: AssistantStatus) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { error } = await supabase.from("assistants").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/assistants/${id}`);
  revalidatePath("/assistants");
}

export async function updateWidgetConfig(assistantId: string, formData: FormData) {
  await requireAdminUser();
  const supabase = createAdminClient();

  const payload = {
    public_slug: slugify(String(formData.get("public_slug") ?? "")),
    is_enabled: formData.get("is_enabled") === "on",
    primary_color: String(formData.get("primary_color") ?? "#0f766e"),
    position: String(formData.get("position") ?? "bottom-right"),
  };

  const { error } = await supabase
    .from("widget_configs")
    .update(payload)
    .eq("assistant_id", assistantId);

  if (error) throw new Error(error.message);
  revalidatePath(`/assistants/${assistantId}`);
}
