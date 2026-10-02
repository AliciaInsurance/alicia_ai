import { getAdminAllowlist } from "@/lib/env";

export const ALLOWED_EMAIL_DOMAIN = "alicia.insure";

function isNonEmpty(value: string | undefined) {
  return Boolean(value?.trim());
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized?.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return false;

  const allowlist = getAdminAllowlist();
  if (allowlist.length > 0 && !allowlist.includes(normalized)) return false;

  return true;
}

export function isAllowedGoogleProfile(profile: {
  email?: string | null;
  email_verified?: boolean | string | null;
}): boolean {
  if (!isAllowedEmail(profile.email)) return false;
  if (profile.email_verified === false || profile.email_verified === "false") {
    return false;
  }
  return true;
}

export function isGoogleAuthConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const secret = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim();
  return (
    isNonEmpty(env.GOOGLE_CLIENT_ID) &&
    isNonEmpty(env.GOOGLE_CLIENT_SECRET) &&
    isNonEmpty(secret)
  );
}

export function isSupabaseLiveConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (
    isNonEmpty(env.NEXT_PUBLIC_SUPABASE_URL) &&
    isNonEmpty(env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

/** Fail closed: auth required on Vercel production or when live Supabase is configured. */
export function isAuthRequiredFromEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.VERCEL_ENV === "production") return true;
  if (env.DEMO_MODE?.trim() === "true") return false;
  return isGoogleAuthConfigured(env) || isSupabaseLiveConfigured(env);
}
