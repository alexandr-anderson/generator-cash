import type { UsageState } from "@prisma/client";
import { prisma } from "./db";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function remainingFromUsage(usage: UsageState | null | undefined) {
  if (!usage) return 0;
  if (usage.initialFreeRemaining > 0) return usage.initialFreeRemaining;
  const elapsed = Date.now() - usage.weekStartedAt.getTime();
  if (elapsed >= WEEK_MS) return usage.generationsPerWeek;
  return Math.max(0, usage.generationsPerWeek - usage.generationsUsed);
}

export function totalFromUsage(usage: UsageState | null | undefined) {
  if (!usage) return 0;
  if (usage.initialFreeRemaining > 0) return 5;
  return usage.generationsPerWeek;
}

export async function consumeGeneration(userId: string) {
  return prisma.$transaction(async (tx) => {
    const usage = await tx.usageState.findUnique({ where: { userId } });
    if (!usage) return { ok: false as const, remaining: 0, error: "Нет данных о лимите" };

    if (usage.initialFreeRemaining > 0) {
      const next = await tx.usageState.update({
        where: { userId },
        data: { initialFreeRemaining: usage.initialFreeRemaining - 1 },
      });
      return { ok: true as const, remaining: remainingFromUsage(next) };
    }

    const elapsed = Date.now() - usage.weekStartedAt.getTime();
    if (elapsed >= WEEK_MS) {
      const next = await tx.usageState.update({
        where: { userId },
        data: { weekStartedAt: new Date(), generationsUsed: 1 },
      });
      return { ok: true as const, remaining: remainingFromUsage(next) };
    }

    if (usage.generationsUsed >= usage.generationsPerWeek) {
      return { ok: false as const, remaining: 0, error: "Генерации закончились" };
    }

    const next = await tx.usageState.update({
      where: { userId },
      data: { generationsUsed: usage.generationsUsed + 1 },
    });
    return { ok: true as const, remaining: remainingFromUsage(next) };
  });
}

export const TIER_LIMITS = {
  free: { generationsPerWeek: 1, priceRub: 0 },
  starter: { generationsPerWeek: 10, priceRub: 50 },
  pro: { generationsPerWeek: 50, priceRub: 200 },
  business: { generationsPerWeek: 100, priceRub: 500 },
} as const;
