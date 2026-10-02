import { redirect } from "next/navigation";
import { auth, isAuthConfigured, isAuthRequired } from "@/lib/auth/auth";
import { isAllowedEmail } from "@/lib/auth/auth-policy";
import { loginErrorMessage } from "@/lib/auth/login-error";

export async function requireAdminUser() {
  if (!isAuthRequired()) {
    return { email: "demo@alicia.insure", id: "demo", name: "Demo" };
  }

  if (!isAuthConfigured()) {
    redirect("/login?error=Configuration");
  }

  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error("[auth] requireAdminUser", error);
    redirect(`/login?error=${encodeURIComponent("Configuration")}`);
  }

  if (!session?.user?.email || !isAllowedEmail(session.user.email)) {
    redirect("/login?next=/assistants");
  }

  return session.user;
}

export function formatLoginError(searchParams: {
  error?: string;
  hint?: string;
  reason?: string;
}) {
  return loginErrorMessage(searchParams.error, searchParams.hint, searchParams.reason);
}
