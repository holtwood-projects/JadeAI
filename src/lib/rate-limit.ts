import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import { config } from '@/lib/config';

interface RateLimitOptions {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function evictIfNeeded(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size < MAX_BUCKETS) return;
  }
  // Every bucket is still active. Drop the oldest entries so attacker-chosen
  // keys cannot make the map grow without bound.
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

/**
 * Fixed-window in-memory rate limiter. Suitable for single-instance
 * self-hosted deployments; not shared across processes.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  evictIfNeeded(now);

  // Unauthenticated tokens are attacker-controlled; keep the bucket map's
  // memory bounded regardless of key length.
  const bucketKey = key.length > 256
    ? `sha256:${createHash('sha256').update(key).digest('hex')}`
    : key;

  const bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return {
      allowed: true,
      remaining: options.limit - 1,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  bucket.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > options.limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return {
    allowed: true,
    remaining: options.limit - bucket.count,
    retryAfterSeconds,
  };
}

/**
 * Client identity for unauthenticated routes.
 *
 * Proxy headers are attacker-controlled unless a trusted reverse proxy sets
 * them. TRUST_PROXY=true must only be enabled when every request reaches this
 * process through such a proxy; otherwise X-Forwarded-For can be forged to
 * obtain a fresh rate-limit bucket on every request.
 */
export function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      // Take the address appended by the trusted proxy, not the leftmost
      // value (which the client controls). TRUST_PROXY_HOPS is the number of
      // proxies in front of this process.
      const hops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS) || 1);
      const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
      const candidate = parts[parts.length - hops];
      if (candidate && isIP(candidate)) return candidate;
    }
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp && isIP(realIp)) return realIp;
    // Fail closed: an unparseable header must not create a fresh bucket.
    return 'unknown';
  }
  return 'direct';
}

/**
 * Bucket key for an authenticated or anonymous caller.
 *
 * In fingerprint mode the request header is client-controlled, so using
 * `user.id` as the key lets a caller mint a fresh bucket by sending a new
 * fingerprint. Key on the client address instead; with TRUST_PROXY unset all
 * anonymous callers share one bucket, which is the only non-spoofable option
 * without a trusted proxy.
 */
export function getRateLimitKey(
  prefix: string,
  user: { id: string },
  request?: Request,
): string {
  if (config.auth.enabled) {
    return `${prefix}:${user.id}`;
  }
  return `${prefix}:anon:${request ? getClientIp(request) : 'direct'}`;
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'Cache-Control': 'private, no-store',
      },
    }
  );
}
