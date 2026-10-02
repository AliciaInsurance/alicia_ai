import { requireAdminUser } from "@/lib/auth/admin";

export default async function KnowledgeSourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();
  return children;
}
