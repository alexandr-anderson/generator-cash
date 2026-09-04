import { draftExpertText } from "@/lib/ai-copy";
import { authed, json } from "@/lib/http";
import { AiError } from "@/lib/openai";

export const maxDuration = 180;

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  if (!user.emailVerifiedAt) {
    return json({ error: "Подтвердите почту, чтобы создавать работы" }, 403);
  }

  const body = await request.json().catch(() => null);
  const topic = String(body?.topic || "").trim();
  if (!topic) return json({ error: "Введите тему" }, 400);
  if (topic.length > 240) return json({ error: "Тема слишком длинная" }, 400);

  try {
    const text = await draftExpertText({
      topic,
      niche: user.niche,
      tone: user.tone || undefined,
    });
    return json({ text });
  } catch (caught) {
    if (caught instanceof AiError) return json({ error: caught.message }, caught.status);
    console.error("[ai/text]", caught);
    return json({ error: "Не удалось сгенерировать текст. Попробуйте ещё раз." }, 502);
  }
}
