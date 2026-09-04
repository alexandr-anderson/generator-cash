import { composeExpertCopy } from "@/lib/ai-copy";
import { authed, json } from "@/lib/http";
import { AiError } from "@/lib/openai";
import { consumeGeneration, quotaAvailable } from "@/lib/quota";
import type { CreativeFormat } from "@/lib/types";

export const maxDuration = 120;

const FORMATS = new Set<CreativeFormat>(["carousel", "post", "reel"]);

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  if (!user.emailVerifiedAt) {
    return json({ error: "Подтвердите почту, чтобы создавать работы" }, 403);
  }

  const quota = quotaAvailable(user.usage);
  if (!quota.ok) return json({ error: quota.error, remaining: quota.remaining }, 402);

  const body = await request.json().catch(() => null);
  const format = String(body?.format || "") as CreativeFormat;
  const topic = String(body?.topic || "").trim();
  const text = String(body?.text || "").trim();
  if (!FORMATS.has(format)) return json({ error: "Выберите формат" }, 400);
  if (!topic) return json({ error: "Введите тему" }, 400);
  if (topic.length > 240) return json({ error: "Тема слишком длинная" }, 400);
  if (text.length > 5000) return json({ error: "Текст слишком длинный" }, 400);

  try {
    const copy = await composeExpertCopy({
      format,
      topic,
      text,
      niche: user.niche,
      tone: user.tone || undefined,
    });
    const consumed = await consumeGeneration(user.id);
    if (!consumed.ok) {
      return json({ error: consumed.error, remaining: consumed.remaining }, 402);
    }
    return json({ ...copy, remaining: consumed.remaining });
  } catch (caught) {
    if (caught instanceof AiError) return json({ error: caught.message }, caught.status);
    console.error("[ai/compose]", caught);
    return json({ error: "Не удалось создать варианты. Попробуйте ещё раз." }, 502);
  }
}
