import { expandCarouselSlides } from "@/lib/ai-copy";
import { authed, json } from "@/lib/http";
import { AiError } from "@/lib/openai";
import { SCENARIO_SPECS } from "@/lib/ai-types";

export const maxDuration = 90;

const SCENARIO_NAMES = new Set<string>(SCENARIO_SPECS.map((item) => item.name));

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  if (!user.emailVerifiedAt) {
    return json({ error: "Подтвердите почту, чтобы создавать работы" }, 403);
  }

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

  try {
    const slides = await expandCarouselSlides({
      topic,
      text,
      niche: user.niche,
      tone: user.tone || undefined,
      scenario,
      firstSlide,
    });
    return json({ slides });
  } catch (caught) {
    if (caught instanceof AiError) return json({ error: caught.message }, caught.status);
    console.error("[ai/expand]", caught);
    return json({ error: "Не удалось дописать слайды. Попробуйте ещё раз." }, 502);
  }
}
