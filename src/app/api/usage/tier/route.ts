import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/quota";
import { loadStudio } from "@/lib/studio";
import type { SubscriptionTier } from "@prisma/client";

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  const body = await request.json().catch(() => null);
  const tier = String(body?.tier || "") as SubscriptionTier;
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];
  if (!limits) return json({ error: "Неизвестный тариф" }, 400);

  await prisma.usageState.update({
    where: { userId: user.id },
    data: {
      tier,
      generationsPerWeek: limits.generationsPerWeek,
      priceRub: limits.priceRub,
    },
  });
  return json(await loadStudio(user.id));
}
