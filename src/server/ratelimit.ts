// Adziga — Rate limiter
// Simple in-memory token bucket. Sufficient for single-instance dev / small prod.
// Swap for Redis-backed limiter (e.g. @upstash/ratelimit) in production.

type Bucket = { tokens: number; lastRefill: number };

const buckets = new Map<string, Bucket>();

const CAPACITY = 60;
const REFILL_RATE_MS = 60_000; // 1 token per second
const REFILL_AMOUNT = CAPACITY;

export function rateLimit(key: string, cost = 1): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= REFILL_RATE_MS) {
    const refill = Math.floor((elapsed / REFILL_RATE_MS) * REFILL_AMOUNT);
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= cost) {
    bucket.tokens -= cost;
    return { allowed: true };
  }
  const retryAfterMs = REFILL_RATE_MS - elapsed;
  return { allowed: false, retryAfterMs };
}

// Periodic cleanup of stale buckets
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (now - b.lastRefill > 600_000) buckets.delete(k);
    }
  }, 300_000).unref?.();
}