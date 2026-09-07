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

  it("adds leftover starter gens on top of a paid plan", () => {
    const state = usage({
      initialFreeRemaining: 5,
      tier: "starter",
      generationsPerWeek: 10,
      generationsUsed: 0,
      weekStartedAt: new Date(),
    });
    expect(remainingFromUsage(state)).toBe(15);
    expect(totalFromUsage(state)).toBe(15);
  });

  it("spends leftover starter gens first and keeps the paid total", () => {
    const unusedWeek = usage({
      initialFreeRemaining: 4,
      tier: "starter",
      generationsPerWeek: 10,
      generationsUsed: 0,
      weekStartedAt: new Date(),
    });
    expect(remainingFromUsage(unusedWeek)).toBe(14);
    expect(totalFromUsage(unusedWeek)).toBe(15);

    const afterWeeklyUse = usage({
      initialFreeRemaining: 5,
      tier: "starter",
      generationsPerWeek: 10,
      generationsUsed: 2,
      weekStartedAt: new Date(),
    });
    expect(remainingFromUsage(afterWeeklyUse)).toBe(13);
    expect(totalFromUsage(afterWeeklyUse)).toBe(15);
  });
});
