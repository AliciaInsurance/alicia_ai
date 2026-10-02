export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
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
    <AdminShell
      eyebrow="Beheer"
      title="Assistants"
      description="Configureer assistenten, kennisbronnen en widget-instellingen."
    >
      <div className="card-surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink">Nieuwe assistant</h2>
        <form action={createAssistant} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input name="internal_name" placeholder="Interne naam" required />
          <Input name="slug" placeholder="slug (optioneel)" />
          <Button type="submit" className="md:self-end">
            Aanmaken
          </Button>
        </form>
      </div>

      <div className="card-surface overflow-hidden">
        <table className="min-w-full text-[15px]">
          <thead className="border-b border-ink/5 bg-cream/60 text-left text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Naam</th>
              <th className="px-5 py-3 font-semibold">Slug</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Klantidentiteit</th>
            </tr>
          </thead>
          <tbody>
            {(assistants as Assistant[] | null)?.map((a) => (
              <tr key={a.id} className="border-t border-ink/5">
                <td className="px-5 py-3">
                  <Link
                    href={`/assistants/${a.id}`}
                    className="font-semibold text-forest hover:underline"
                  >
                    {a.internal_name}
                  </Link>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-stone">{a.slug}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-5 py-3 text-muted">{a.customer_display_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
