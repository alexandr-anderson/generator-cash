import { describe, expect, it } from "vitest";
import { checkLimit, pruneStore, type RateLimitStore } from "./rate-limit";

const RULE = { limit: 3, windowMs: 1000 };

function store(): RateLimitStore {
  return new Map();
}

describe("checkLimit", () => {
  it("allows requests up to the limit", () => {
    const s = store();
    expect(checkLimit(s, "a", 0, RULE)).toEqual({ ok: true, remaining: 2 });
    expect(checkLimit(s, "a", 10, RULE)).toEqual({ ok: true, remaining: 1 });
    expect(checkLimit(s, "a", 20, RULE)).toEqual({ ok: true, remaining: 0 });
  });

  it("blocks once the limit is reached and reports the wait", () => {
    const s = store();
    checkLimit(s, "a", 0, RULE);
    checkLimit(s, "a", 10, RULE);
    checkLimit(s, "a", 20, RULE);

    const verdict = checkLimit(s, "a", 30, RULE);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.retryAfterMs).toBe(970);
  });

  it("does not count a blocked attempt as a new hit", () => {
    const s = store();
    checkLimit(s, "a", 0, RULE);
    checkLimit(s, "a", 0, RULE);
    checkLimit(s, "a", 0, RULE);
    checkLimit(s, "a", 500, RULE);

    // The window still ends 1000ms after the first hit, not after the rejection.
    const verdict = checkLimit(s, "a", 900, RULE);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.retryAfterMs).toBe(100);
  });

  it("lets requests through again once the window slides past", () => {
    const s = store();
    checkLimit(s, "a", 0, RULE);
    checkLimit(s, "a", 10, RULE);
    checkLimit(s, "a", 20, RULE);
    expect(checkLimit(s, "a", 30, RULE).ok).toBe(false);
    expect(checkLimit(s, "a", 1001, RULE)).toEqual({ ok: true, remaining: 0 });
  });

  it("keeps keys independent", () => {
    const s = store();
    checkLimit(s, "a", 0, RULE);
    checkLimit(s, "a", 0, RULE);
    checkLimit(s, "a", 0, RULE);
    expect(checkLimit(s, "a", 0, RULE).ok).toBe(false);
    expect(checkLimit(s, "b", 0, RULE).ok).toBe(true);
  });
});

describe("pruneStore", () => {
  it("drops keys with no live hits and keeps the rest", () => {
    const s = store();
    checkLimit(s, "old", 0, RULE);
    checkLimit(s, "fresh", 900, RULE);

    pruneStore(s, 1000, RULE.windowMs);

    expect(s.has("old")).toBe(false);
    expect(s.get("fresh")).toEqual([900]);
  });
});
