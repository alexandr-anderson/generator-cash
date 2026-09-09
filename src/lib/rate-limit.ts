// In-memory sliding-window limiter. PM2 runs a single fork-mode process
// (ecosystem.config.cjs), so a module-level store is shared by every request
// and no external store is needed. Counters reset on restart — acceptable for
// slowing down brute force and metered-API abuse.

export type RateLimitRule = { limit: number; windowMs: number };
export type RateLimitStore = Map<string, number[]>;

export type RateLimitVerdict =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

export const RATE_RULES = {
  loginIp: { limit: 10, windowMs: 15 * 60 * 1000 },
  loginEmail: { limit: 5, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  forgotIp: { limit: 3, windowMs: 60 * 60 * 1000 },
  forgotEmail: { limit: 3, windowMs: 60 * 60 * 1000 },
  ai: { limit: 20, windowMs: 60 * 60 * 1000 },
  upload: { limit: 30, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export function checkLimit(
  store: RateLimitStore,
  key: string,
  now: number,
  rule: RateLimitRule,
): RateLimitVerdict {
  const cutoff = now - rule.windowMs;
  const hits = (store.get(key) || []).filter((at) => at > cutoff);

  if (hits.length >= rule.limit) {
    store.set(key, hits);
    const oldest = hits[0];
    return { ok: false, retryAfterMs: Math.max(0, oldest + rule.windowMs - now) };
  }

  hits.push(now);
  store.set(key, hits);
  return { ok: true, remaining: rule.limit - hits.length };
}

export function pruneStore(store: RateLimitStore, now: number, maxWindowMs: number) {
  const cutoff = now - maxWindowMs;
  for (const [key, hits] of store) {
    const live = hits.filter((at) => at > cutoff);
    if (live.length === 0) store.delete(key);
    else store.set(key, live);
  }
}

const STORE: RateLimitStore = new Map();
const MAX_WINDOW_MS = 60 * 60 * 1000;
let lastPrunedAt = 0;

export function clientIp(request: Request) {
  // Set by public_html/index.php from REMOTE_ADDR; any client-sent value is
  // stripped there, so this cannot be spoofed by the caller.
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || "unknown";
}

export function rateLimit(scope: string, id: string, rule: RateLimitRule) {
  const now = Date.now();
  if (now - lastPrunedAt > MAX_WINDOW_MS) {
    pruneStore(STORE, now, MAX_WINDOW_MS);
    lastPrunedAt = now;
  }

  const verdict = checkLimit(STORE, `${scope}:${id}`, now, rule);
  if (verdict.ok) return null;

  const retryAfter = Math.ceil(verdict.retryAfterMs / 1000);
  return Response.json(
    { error: "Слишком много запросов. Попробуйте позже." },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}

// One in-flight AI generation per user. Each request occupies an Apache PHP
// worker for up to 200s (public_html/index.php), so a handful of parallel slow
// requests can starve the pool and take the whole site down.
const IN_FLIGHT = new Set<string>();

export function acquireSlot(userId: string) {
  if (IN_FLIGHT.has(userId)) return false;
  IN_FLIGHT.add(userId);
  return true;
}

export function releaseSlot(userId: string) {
  IN_FLIGHT.delete(userId);
}

export function busyResponse() {
  return Response.json(
    { error: "Предыдущая генерация ещё идёт. Дождитесь её окончания." },
    { status: 429, headers: { "retry-after": "30" } },
  );
}
