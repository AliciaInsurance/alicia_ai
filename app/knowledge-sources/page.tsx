import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminUser } from "@/lib/auth/admin";
import { createKnowledgeSource } from "@/lib/actions/knowledge";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KnowledgeSource } from "@/lib/types/database";

export default async function KnowledgeSourcesPage() {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: sources } = await supabase
    .from("knowledge_sources")
    .select("*")
    .order("name");

  return (
    <AdminShell title="Knowledge sources">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Create knowledge source</h2>
        <form action={createKnowledgeSource} className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            name="name"
            placeholder="Name"
            required
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            name="slug"
            placeholder="slug (optional)"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white"
          >
            Create
          </button>
        </form>
      </div>

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {(sources as KnowledgeSource[] | null)?.map((s) => (
          <li key={s.id} className="px-4 py-3">
            <Link href={`/knowledge-sources/${s.id}`} className="font-medium text-teal-800 hover:underline">
              {s.name}
            </Link>
            <div className="text-xs text-slate-500">{s.slug}</div>
            {s.description ? <p className="mt-1 text-sm text-slate-600">{s.description}</p> : null}
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
