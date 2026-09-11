import { draftExpertText, draftReelHooks } from "@/lib/ai-copy";
import { authed, json } from "@/lib/http";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { AiError } from "@/lib/openai";
import { notifyGenerationFailure } from "@/lib/alerts";
import { RATE_RULES, acquireSlot, busyResponse, rateLimit, releaseSlot } from "@/lib/rate-limit";

export const maxDuration = 180;

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  if (!user.emailVerifiedAt) {
    return json({ error: `Почта ещё не подтверждена: откройте ссылку из письма, которое пришло при регистрации. Если письма нет, напишите на ${SUPPORT_EMAIL}.` }, 403);
  }

  const limited = rateLimit("ai", user.id, RATE_RULES.ai);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const topic = String(body?.topic || "").trim();
  const format = String(body?.format || "");
  if (!topic) return json({ error: "Введите тему" }, 400);
  if (topic.length > 240) return json({ error: "Тема длиннее 240 символов. Сократите её до одной фразы." }, 400);

  // Taken last, so no validation branch can return while holding it.
  if (!acquireSlot(user.id)) return busyResponse();

  try {
    if (format === "reel") {
      const hooks = await draftReelHooks({
        topic,
        niche: user.niche,
        tone: user.tone || undefined,
        authorHook: String(body?.text || "").trim() || undefined,
      });
      return json({ hooks });
    }
    const text = await draftExpertText({
      topic,
      niche: user.niche,
      tone: user.tone || undefined,
    });
    return json({ text });
  } catch (caught) {
    if (caught instanceof AiError) {
      notifyGenerationFailure("text", caught);
      return json({ error: caught.message }, caught.status);
    }
    console.error("[ai/text]", caught);
    notifyGenerationFailure("text", caught);
    return json({ error: "Не удалось написать текст. Попробуйте ещё раз — генерация на это не тратится." }, 502);
  } finally {
    releaseSlot(user.id);
  }
}
