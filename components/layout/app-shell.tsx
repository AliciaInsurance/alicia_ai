import { AppNav } from "@/components/layout/app-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
