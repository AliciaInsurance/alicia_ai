import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { KNOWLEDGE_TYPE_LABELS } from "@/lib/knowledge/constants";
import type { KnowledgeItem } from "@/lib/types/database";

function formatValidity(item: KnowledgeItem): string {
  const from = item.valid_from ? new Date(item.valid_from).toLocaleDateString("nl-NL") : "—";
  const until = item.valid_until ? new Date(item.valid_until).toLocaleDateString("nl-NL") : "—";
  return `${from} → ${until}`;
}

export function SourceItemsTable({
  sourceId,
  items,
}: {
  sourceId: string;
  items: KnowledgeItem[];
}) {
  if (!items.length) {
    return <p className="text-muted text-[15px]">Nog geen kennisitems.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[15px]">
        <thead>
          <tr className="border-b border-ink/5 text-xs text-stone">
            <th className="py-2 pr-4 font-semibold">Titel</th>
            <th className="py-2 pr-4 font-semibold">Type</th>
            <th className="py-2 pr-4 font-semibold">Versie</th>
            <th className="py-2 pr-4 font-semibold">Status</th>
            <th className="py-2 pr-4 font-semibold">Review</th>
            <th className="py-2 pr-4 font-semibold">Geldigheid</th>
            <th className="py-2 font-semibold">Bijgewerkt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-ink/5">
              <td className="py-3 pr-4">
                <Link
                  href={`/knowledge-sources/${sourceId}/items/${item.id}`}
                  className="font-semibold text-forest hover:underline"
                >
                  {item.title}
                </Link>
              </td>
              <td className="py-3 pr-4 text-muted">
                {KNOWLEDGE_TYPE_LABELS[item.knowledge_type] ?? item.knowledge_type}
              </td>
              <td className="py-3 pr-4 text-muted">{item.version_label ?? "—"}</td>
              <td className="py-3 pr-4">
                <StatusBadge status={item.status} />
              </td>
              <td className="py-3 pr-4">
                <StatusBadge status={item.review_status} />
              </td>
              <td className="py-3 pr-4 text-xs text-muted">{formatValidity(item)}</td>
              <td className="py-3 text-xs text-muted">
                {new Date(item.updated_at).toLocaleString("nl-NL")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
