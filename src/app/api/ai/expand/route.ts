import { expandCarouselSlides } from "@/lib/ai-copy";
import { authed, json } from "@/lib/http";
import { AiError } from "@/lib/openai";
import { notifyGenerationFailure } from "@/lib/alerts";
import { consumeGeneration, quotaAvailable } from "@/lib/quota";
import { RATE_RULES, acquireSlot, busyResponse, rateLimit, releaseSlot } from "@/lib/rate-limit";
import { ndjsonStream } from "@/lib/http-stream";
import { SCENARIO_SPECS } from "@/lib/ai-types";

// Вызов модели ждёт до 180 с. Раньше здесь стояло ровно 180 — роут мог умереть
// раньше, чем спишет лимит и ответит, а замеры показали 2,5 минуты на ответ.
// Держим запас поверх таймаута модели.
export const maxDuration = 300;

const SCENARIO_NAMES = new Set<string>(SCENARIO_SPECS.map((item) => item.name));

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  if (!user.emailVerifiedAt) {
    return json({ error: "Подтвердите почту, чтобы создавать работы" }, 403);
  }

  const limited = rateLimit("ai", user.id, RATE_RULES.ai);
  if (limited) return limited;

  const quota = quotaAvailable(user.usage);
  if (!quota.ok) return json({ error: quota.error, remaining: quota.remaining }, 402);

  const body = await request.json().catch(() => null);
  const topic = String(body?.topic || "").trim();
  const text = String(body?.text || "").trim();
  const scenario = String(body?.scenario || "").trim();
  const firstSlide = String(body?.firstSlide || "").trim();
  if (!topic) return json({ error: "Введите тему" }, 400);
  if (!scenario || !SCENARIO_NAMES.has(scenario)) return json({ error: "Выберите сценарий" }, 400);
  if (!firstSlide) return json({ error: "Нет текста первого слайда" }, 400);
  if (topic.length > 240 || firstSlide.length > 240) return json({ error: "Слишком длинный текст" }, 400);
  if (text.length > 5000) return json({ error: "Текст слишком длинный" }, 400);

  // Taken last, so no validation branch can return while holding it.
  if (!acquireSlot(user.id)) return busyResponse();

  // Дальше начинается работа с моделью — уходим в поток. Всё, что могло
  // отказать до этой точки, уже ответило обычным JSON с честным кодом.
  return ndjsonStream(
    async (emit) => {
      try {
        const copy = await expandCarouselSlides({
          topic,
          text,
          niche: user.niche,
          tone: user.tone || undefined,
          scenario,
          firstSlide,
          onDelta: (chunk) => emit({ type: "delta", text: chunk }),
        });
        const consumed = await consumeGeneration(user.id);
        if (!consumed.ok) throw new AiError(consumed.error || "Генерации закончились", 402);
        return { ...copy, remaining: consumed.remaining };
      } catch (caught) {
        notifyGenerationFailure("expand", caught);
        throw caught;
      }
    },
    () => releaseSlot(user.id),
  );
}
