import { describe, expect, it } from "vitest";
import {
  FREE_STARTER_GENERATIONS,
  remainingFromUsage,
  totalFromUsage,
  weeklyRemainingFromUsage,
} from "./quota";
import type { UsageState } from "@prisma/client";

function usage(overrides: Partial<UsageState>): UsageState {
  return {
    id: "us1",
    userId: "u1",
    tier: "free",
    generationsPerWeek: 1,
    priceRub: 0,
    generationsUsed: 0,
    weekStartedAt: new Date(),
    initialFreeRemaining: 5,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("quota display", () => {
  it("uses the free pool while it lasts", () => {
    const state = usage({ initialFreeRemaining: 8 });
    expect(remainingFromUsage(state)).toBe(8);
    expect(totalFromUsage(state)).toBe(8);
    expect(FREE_STARTER_GENERATIONS).toBe(5);
  });

  it("keeps the original 5 as total after some free uses", () => {
    const state = usage({ initialFreeRemaining: 3 });
    expect(remainingFromUsage(state)).toBe(3);
    expect(totalFromUsage(state)).toBe(5);
  });

  it("falls back to the weekly quota", () => {
    const state = usage({
      initialFreeRemaining: 0,
      tier: "starter",
      generationsPerWeek: 10,
      generationsUsed: 2,
      weekStartedAt: new Date(),
    });
    expect(remainingFromUsage(state)).toBe(8);
    expect(weeklyRemainingFromUsage(state)).toBe(8);
    expect(totalFromUsage(state)).toBe(10);
  });
});
