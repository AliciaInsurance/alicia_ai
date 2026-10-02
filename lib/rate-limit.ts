/**
 * Development-only in-memory rate limiter for local/single-instance use.
 *
 * Not reliable for production: counters are per Node process, reset on cold
 * starts, and are not shared across horizontally scaled instances (e.g. Vercel).
 *
 * Production prerequisite: replace with a shared store (Redis, Upstash, etc.)
 * before treating this as abuse protection.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { allowed: true };
}
