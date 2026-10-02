import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminUser } from "@/lib/auth/admin";
import { createAssistant } from "@/lib/actions/assistants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Assistant } from "@/lib/types/database";

export default async function AssistantsPage() {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: assistants } = await supabase
    .from("assistants")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <AdminShell title="Assistants">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Create assistant</h2>
        <form action={createAssistant} className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            name="internal_name"
            placeholder="Internal name"
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Customer identity</th>
            </tr>
          </thead>
          <tbody>
            {(assistants as Assistant[] | null)?.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <Link href={`/assistants/${a.id}`} className="font-medium text-teal-800 hover:underline">
                    {a.internal_name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{a.slug}</td>
                <td className="px-4 py-3">{a.status}</td>
                <td className="px-4 py-3">{a.customer_display_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
