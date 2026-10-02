import { requireAdminUser } from "@/lib/auth/admin";

export default async function AssistantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();
  return children;
}
