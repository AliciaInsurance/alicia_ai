import { AppShell } from "@/components/layout/app-shell";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export function AdminShell({
  children,
  title,
  description,
  eyebrow,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <AppShell>
      <PageContainer>
        {title ? (
          <PageHeader eyebrow={eyebrow} title={title} description={description} />
        ) : null}
        {children}
      </PageContainer>
    </AppShell>
  );
}
