/**
 * In-memory IP-keyed token bucket. Resets per process — fine for a single
 * Next.js instance, NOT durable across deploys or horizontally scaled
 * deployments. A future MT phase can swap this for Redis / Upstash without
 * touching call sites.
 */

type Bucket = { hits: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  capacity: number; // max hits per window
  windowMs: number; // window length in ms
};

export function checkRateLimit(
  scope: string,
  ip: string | null | undefined,
  opts: RateLimitOptions,
): boolean {
  if (!ip) return true; // Don't block if we can't identify the caller.
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart >= opts.windowMs) {
    buckets.set(key, { hits: 1, windowStart: now });
    return true;
  }
  if (existing.hits >= opts.capacity) return false;
  existing.hits += 1;
  return true;
}

/** Visible for tests — clears all buckets. Don't call from app code. */
export function __resetRateLimit(): void {
  buckets.clear();
}
