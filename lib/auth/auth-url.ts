export const CANONICAL_PRODUCTION_HOST = "ask.alicia.insure";
export const CANONICAL_PRODUCTION_URL = `https://${CANONICAL_PRODUCTION_HOST}`;

function trimEnv(env: Record<string, string | undefined>, name: string) {
  const value = env[name];
  return value?.trim() ? value.trim().replace(/\/$/, "") : undefined;
}

function isVercelAppUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith(".vercel.app");
  } catch {
    return url.includes("vercel.app");
  }
}

/**
 * Auth.js base URL. Production is always ask.alicia.insure so Google redirect_uri
 * and session cookies stay on the custom domain (not *.vercel.app).
 */
export function resolveAuthUrl(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const configured = trimEnv(env, "AUTH_URL");
  const vercelEnv = env.VERCEL_ENV;

  if (vercelEnv === "production") {
    return CANONICAL_PRODUCTION_URL;
  }

  if (vercelEnv === "preview") {
    const deployment = trimEnv(env, "VERCEL_URL");
    if (deployment) return `https://${deployment.replace(/^https?:\/\//, "")}`;
  }

  if (configured && !configured.includes("localhost") && !isVercelAppUrl(configured)) {
    return configured;
  }

  const vercelUrl = trimEnv(env, "VERCEL_URL");
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;

  return configured ?? "http://localhost:3000";
}

export function isCanonicalProductionHost(host: string | null | undefined) {
  const hostname = host?.split(":")[0]?.toLowerCase();
  return hostname === CANONICAL_PRODUCTION_HOST;
}

export function isVercelProductionAlias(host: string | null | undefined) {
  const hostname = host?.split(":")[0]?.toLowerCase();
  if (!hostname) return false;
  return hostname.endsWith(".vercel.app");
}
