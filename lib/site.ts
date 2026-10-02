/** Canonical production host — must match the Vercel custom domain. */
export const PRODUCTION_HOST = "ask.alicia.insure";

export const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;

export const AUTH_CALLBACK_PATH = "/api/auth/callback/google";

export function productionAuthCallbackUrl() {
  return `${PRODUCTION_ORIGIN}${AUTH_CALLBACK_PATH}`;
}
