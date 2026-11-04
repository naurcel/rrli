/**
 * In-memory sliding-window rate limiter for RouteX authentication endpoints.
 */

type RateLimitRecord = {
  attempts: number[];
  lockedUntil?: number;
};

const store = new Map<string, RateLimitRecord>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec?: number;
};

/**
 * Checks and records an attempt against a specific rate-limit bucket.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 5 * 60 * 1000, // 5 minutes
  lockoutDurationMs: number = 5 * 60 * 1000,
): RateLimitResult {
  const now = Date.now();
  let record = store.get(key);

  if (!record) {
    record = { attempts: [] };
    store.set(key, record);
  }

  // Check if currently locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  // Clear lock if expired
  if (record.lockedUntil && record.lockedUntil <= now) {
    record.lockedUntil = undefined;
    record.attempts = [];
  }

  // Filter attempts within the sliding window
  record.attempts = record.attempts.filter((timestamp) => now - timestamp < windowMs);

  if (record.attempts.length >= maxAttempts) {
    record.lockedUntil = now + lockoutDurationMs;
    const retryAfterSec = Math.ceil(lockoutDurationMs / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  record.attempts.push(now);
  const remaining = Math.max(0, maxAttempts - record.attempts.length);

  return {
    allowed: true,
    remaining,
  };
}

/**
 * Resets rate limit tracking upon successful authentication or recovery.
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

