export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdminUser } from "@/lib/auth/admin";
import { createKnowledgeSource } from "@/lib/actions/knowledge";
import { DatabaseNotice } from "@/components/admin/database-notice";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { checkAliciaAiDatabase } from "@/lib/supabase/status";
import type { KnowledgeSource } from "@/lib/types/database";

export default async function KnowledgeSourcesPage() {
  await requireAdminUser();

  const dbHealth = await checkAliciaAiDatabase();
  let sources: KnowledgeSource[] | null = null;

  if (dbHealth.reachable && isSupabaseAdminConfigured()) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select("*")
      .order("name");
    if (!error) sources = data as KnowledgeSource[] | null;
    else console.error("[knowledge-sources] list failed", error.message);
  }

  return (
    <AdminShell
      eyebrow="Beheer"
      title="Kennisbronnen"
      description="Documenten en FAQ's voor RAG-retrieval per assistant."
    >
      <DatabaseNotice health={dbHealth} />
      <div className="card-surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink">Nieuwe kennisbron</h2>
        <form action={createKnowledgeSource} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input name="name" placeholder="Naam" required />
          <Input name="slug" placeholder="slug (optioneel)" />
          <Button type="submit" className="md:self-end">
            Aanmaken
          </Button>
        </form>
      </div>

      <ul className="card-surface divide-y divide-ink/5">
        {(sources as KnowledgeSource[] | null)?.map((s) => (
          <li key={s.id} className="px-5 py-4 sm:px-6">
            <Link
              href={`/knowledge-sources/${s.id}`}
              className="font-semibold text-forest hover:underline"
            >
              {s.name}
            </Link>
            <div className="text-xs text-stone">{s.slug}</div>
            {s.description ? (
              <p className="mt-1 text-[15px] text-muted">{s.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
