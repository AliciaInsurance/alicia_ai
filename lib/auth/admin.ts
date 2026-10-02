import { redirect } from "next/navigation";
import { getAdminAllowlist } from "@/lib/env";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function requireAdminUser() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/assistants");
  }

  const allowlist = getAdminAllowlist();
  if (allowlist.length > 0) {
    const email = user.email?.toLowerCase();
    if (!email || !allowlist.includes(email)) {
      redirect("/login?error=unauthorized");
    }
  }

  return user;
}
