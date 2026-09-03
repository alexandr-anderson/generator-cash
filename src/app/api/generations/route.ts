import { authed, json } from "@/lib/http";
import { consumeGeneration, remainingFromUsage, totalFromUsage } from "@/lib/quota";

export async function GET() {
  const { user, error } = await authed();
  if (error) return error;
  return json({
    remaining: remainingFromUsage(user.usage),
    total: totalFromUsage(user.usage),
    subscription: user.usage,
  });
}

export async function POST() {
  const { user, error } = await authed();
  if (error) return error;
  if (!user.emailVerifiedAt) {
    return json({ error: "Подтвердите почту, чтобы создавать работы" }, 403);
  }
  const result = await consumeGeneration(user.id);
  if (!result.ok) return json({ error: result.error, remaining: result.remaining }, 402);
  return json({ ok: true, remaining: result.remaining });
}
