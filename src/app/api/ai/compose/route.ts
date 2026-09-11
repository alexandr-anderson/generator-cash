import { composePostCopy, composeReelCopy, composeVariantPreviews } from "@/lib/ai-copy";
import { attachPostImages, attachReelImages } from "@/lib/ai-image";
import { ensureCarouselRecipe } from "@/lib/ensure-carousel-recipe";
import { authed, json } from "@/lib/http";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { AiError } from "@/lib/openai";
import { notifyGenerationFailure } from "@/lib/alerts";
import { consumeGeneration, quotaAvailable } from "@/lib/quota";
import { RATE_RULES, acquireSlot, busyResponse, rateLimit, releaseSlot } from "@/lib/rate-limit";
import { ndjsonStream } from "@/lib/http-stream";
import type { CreativeFormat } from "@/lib/types";

export const maxDuration = 300;

const FORMATS = new Set<CreativeFormat>(["carousel", "post", "reel"]);

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  if (!user.emailVerifiedAt) {
    return json({ error: `Почта ещё не подтверждена: откройте ссылку из письма, которое пришло при регистрации. Если письма нет, напишите на ${SUPPORT_EMAIL}.` }, 403);
  }

  const limited = rateLimit("ai", user.id, RATE_RULES.ai);
  if (limited) return limited;

  const quota = quotaAvailable(user.usage);
  if (!quota.ok) return json({ error: quota.error, remaining: quota.remaining }, 402);

  const body = await request.json().catch(() => null);
  const format = String(body?.format || "") as CreativeFormat;
  const topic = String(body?.topic || "").trim();
  const text = String(body?.text || "").trim();
  const captionSource = String(body?.captionSource || "").trim();
  const rubricId = String(body?.rubricId || "") || null;
  const colors = Array.isArray(body?.colors)
    ? body.colors.filter((item: unknown) => typeof item === "string").slice(0, 4)
    : [];
  const referenceIds = Array.isArray(body?.referenceIds)
    ? body.referenceIds.filter((item: unknown) => typeof item === "string").slice(0, 4)
    : [];
  if (!FORMATS.has(format)) return json({ error: "Выберите формат" }, 400);
  if (!topic) return json({ error: "Введите тему" }, 400);
  if (topic.length > 240) return json({ error: "Тема длиннее 240 символов. Сократите её до одной фразы." }, 400);
  if (text.length > 5000) return json({ error: "Текст длиннее 5000 символов. Укоротите его." }, 400);
  if (captionSource.length > 8000) return json({ error: "Подпись длиннее 8000 символов. Укоротите её." }, 400);

  // Taken last, so no validation branch can return while holding it.
  if (!acquireSlot(user.id)) return busyResponse();

  // Дальше начинается работа с моделью — уходим в поток. Всё, что могло
  // отказать до этой точки, уже ответило обычным JSON с честным кодом.
  return ndjsonStream(
    async (emit) => {
      const onDelta = (chunk: string) => emit({ type: "delta", text: chunk });
      try {
        const copy = format === "post"
          ? await composePost(user.id, {
              topic,
              text,
              niche: user.niche,
              tone: user.tone || undefined,
              rubricId,
              colors,
              referenceIds,
              onDelta,
            })
          : format === "reel"
            ? await composeReel(user.id, {
                topic,
                text,
                captionSource,
                niche: user.niche,
                tone: user.tone || undefined,
                rubricId,
                colors,
                referenceIds,
                onDelta,
              })
          : await composeVariantPreviews({
              format,
              topic,
              text,
              niche: user.niche,
              tone: user.tone || undefined,
              onDelta,
            });
        if (format === "carousel") {
          const carouselRecipe = await ensureCarouselRecipe({
            userId: user.id,
            rubricId,
            referenceIds,
          });
          return { ...copy, remaining: quota.remaining, carouselRecipe };
        }
        const consumed = await consumeGeneration(user.id);
        if (!consumed.ok) throw new AiError(consumed.error || "Генерации закончились", 402);
        return { ...copy, remaining: consumed.remaining };
      } catch (caught) {
        notifyGenerationFailure("compose", caught);
        throw caught;
      }
    },
    () => releaseSlot(user.id),
  );
}

async function composePost(
  userId: string,
  input: {
    topic: string;
    text: string;
    niche: string;
    tone?: string;
    rubricId: string | null;
    colors: string[];
    referenceIds: string[];
    onDelta?: (chunk: string) => void;
  },
) {
  // Текст и картинки друг от друга не зависят, а каждый заход к шлюзу стоит
  // около двух минут (замер 2026-09-10), поэтому идут одновременно. Раньше
  // ждали последовательно и складывали эти минуты без всякой нужды.
  const [copy, imageUrls] = await Promise.all([
    composePostCopy({
      topic: input.topic,
      text: input.text,
      niche: input.niche,
      onDelta: input.onDelta,
    }),
    attachPostImages({
      userId,
      rubricId: input.rubricId,
      topic: input.topic,
      niche: input.niche,
      tone: input.tone,
      text: input.text,
      colors: input.colors,
      referenceIds: input.referenceIds,
    }),
  ]);

  return {
    ...copy,
    scenarios: copy.scenarios.map((scenario, index) => ({
      ...scenario,
      imageUrl: imageUrls[index],
    })),
  };
}

async function composeReel(
  userId: string,
  input: {
    topic: string;
    text: string;
    captionSource?: string;
    niche: string;
    tone?: string;
    rubricId: string | null;
    colors: string[];
    referenceIds: string[];
    onDelta?: (chunk: string) => void;
  },
) {
  // Как и у поста: текст и обложки независимы, ждём их одновременно.
  const [copy, imageUrls] = await Promise.all([
    composeReelCopy({
      topic: input.topic,
      niche: input.niche,
      tone: input.tone,
      authorHook: input.text,
      captionSource: input.captionSource,
      onDelta: input.onDelta,
    }),
    attachReelImages({
      userId,
      rubricId: input.rubricId,
      topic: input.topic,
      niche: input.niche,
      tone: input.tone,
      colors: input.colors,
      referenceIds: input.referenceIds,
    }),
  ]);

  return {
    ...copy,
    scenarios: copy.scenarios.map((scenario, index) => ({
      ...scenario,
      imageUrl: imageUrls[index],
    })),
  };
}
