import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export function AdminShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/assistants" className="font-semibold tracking-tight">
              Alicia AI
            </Link>
            <nav className="flex gap-3 text-sm text-slate-600">
              <Link href="/assistants" className="hover:text-slate-900">
                Assistants
              </Link>
              <Link href="/knowledge-sources" className="hover:text-slate-900">
                Knowledge
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <button type="submit" className="text-sm text-slate-600 hover:text-slate-900">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {title ? <h1 className="mb-4 text-2xl font-semibold">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}
