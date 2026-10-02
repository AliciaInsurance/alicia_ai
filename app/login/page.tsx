import { signIn } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Alicia AI Admin</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in with your Alicia Supabase account.</p>

        {params.error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {decodeURIComponent(params.error)}
          </p>
        ) : null}

        <form action={signIn} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={params.next ?? "/assistants"} />
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
