export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AddKnowledgePanel } from "@/components/knowledge/add-knowledge-panel";
import { SourceItemsTable } from "@/components/knowledge/source-items-table";
import { requireAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Assistant, KnowledgeItem, KnowledgeSource } from "@/lib/types/database";
import type { AssistantSource } from "@/lib/types/supabase-database";

export default async function KnowledgeSourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const { data: sourceRow } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const source = sourceRow as KnowledgeSource | null;
  if (!source) notFound();

  const { data: items } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("knowledge_source_id", id)
    .order("updated_at", { ascending: false });

  const { data: links } = await supabase
    .from("assistant_sources")
    .select("assistant_id")
    .eq("knowledge_source_id", id);

  const assistantIds = ((links ?? []) as AssistantSource[]).map((l) => l.assistant_id);
  let attachedAssistants: Pick<Assistant, "id" | "internal_name" | "slug">[] = [];
  if (assistantIds.length > 0) {
    const { data: assistantRows } = await supabase
      .from("assistants")
      .select("id, internal_name, slug")
      .in("id", assistantIds);
    attachedAssistants = (assistantRows ?? []) as Pick<
      Assistant,
      "id" | "internal_name" | "slug"
    >[];
  }

  return (
    <AdminShell
      eyebrow="Kennisbron"
      title={source.name}
      description={source.description ?? undefined}
    >
      {query.error ? (
        <p role="alert" className="mb-6 rounded-2xl bg-danger-bg px-5 py-4 text-[15px] text-danger">
          {query.error}
        </p>
      ) : null}
      {query.notice ? (
        <p className="mb-6 rounded-2xl bg-warn-bg px-5 py-4 text-[15px] text-warn">{query.notice}</p>
      ) : null}

      <section className="card-surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink">Gekoppelde assistenten</h2>
        <ul className="mt-3 space-y-1 text-[15px]">
          {attachedAssistants.map((a) => (
            <li key={a.id}>
              <Link href={`/assistants/${a.id}`} className="text-forest hover:underline">
                {a.internal_name}
              </Link>
              <span className="text-xs text-stone"> · {a.slug}</span>
            </li>
          ))}
          {!attachedAssistants.length ? (
            <li className="text-muted">Nog niet gekoppeld aan een assistant.</li>
          ) : null}
        </ul>
      </section>

      <AddKnowledgePanel sourceId={id} />

      <section className="card-surface mt-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink">Kennisitems</h2>
        <div className="mt-4">
          <SourceItemsTable sourceId={id} items={(items ?? []) as KnowledgeItem[]} />
        </div>
      </section>
    </AdminShell>
  );
}
