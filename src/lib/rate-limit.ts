// Small in-memory limiter for login and the public booking form. It is per
// server instance, which is enough to slow down password guessing and spam.
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** True while `key` has already used up `limit` in its window, without counting a new hit. */
export function overLimit(key: string, limit: number): boolean {
  const entry = hits.get(key);
  return !!entry && entry.resetAt >= Date.now() && entry.count >= limit;
}

/** Forget the hits for `key`, for example after a successful sign-in. */
export function clearRateLimit(key: string) {
  hits.delete(key);
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
