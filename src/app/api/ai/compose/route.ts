import { composePostFromAuthorText, composeReelCopy, composeVariantPreviews } from "@/lib/ai-copy";
import { attachPostImages, attachReelImages } from "@/lib/ai-image";
import { authed, json } from "@/lib/http";
import { AiError } from "@/lib/openai";
import { consumeGeneration, quotaAvailable } from "@/lib/quota";
import type { CreativeFormat } from "@/lib/types";

export const maxDuration = 300;

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
  const rubricId = String(body?.rubricId || "") || null;
  const colors = Array.isArray(body?.colors)
    ? body.colors.filter((item: unknown) => typeof item === "string").slice(0, 4)
    : [];
  const referenceIds = Array.isArray(body?.referenceIds)
    ? body.referenceIds.filter((item: unknown) => typeof item === "string").slice(0, 4)
    : [];
  if (!FORMATS.has(format)) return json({ error: "Выберите формат" }, 400);
  if (!topic) return json({ error: "Введите тему" }, 400);
  if (topic.length > 240) return json({ error: "Тема слишком длинная" }, 400);
  if (text.length > 5000) return json({ error: "Текст слишком длинный" }, 400);

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
        })
      : format === "reel"
        ? await composeReel(user.id, {
            topic,
            text,
            niche: user.niche,
            tone: user.tone || undefined,
            rubricId,
            colors,
            referenceIds,
          })
      : await composeVariantPreviews({
          format,
          topic,
          text,
          niche: user.niche,
          tone: user.tone || undefined,
        });
    if (format === "carousel") {
      return json({ ...copy, remaining: quota.remaining });
    }
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
  },
) {
  const copy = composePostFromAuthorText({
    topic: input.topic,
    text: input.text,
    niche: input.niche,
  });
  const imageUrls = await attachPostImages({
    userId,
    rubricId: input.rubricId,
    topic: input.topic,
    niche: input.niche,
    tone: input.tone,
    text: input.text,
    colors: input.colors,
    referenceIds: input.referenceIds,
  });

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
    niche: string;
    tone?: string;
    rubricId: string | null;
    colors: string[];
    referenceIds: string[];
  },
) {
  const copy = await composeReelCopy({
    topic: input.topic,
    niche: input.niche,
    tone: input.tone,
    authorHook: input.text,
  });
  const imageUrls = await attachReelImages({
    userId,
    rubricId: input.rubricId,
    topic: input.topic,
    niche: input.niche,
    tone: input.tone,
    colors: input.colors,
    referenceIds: input.referenceIds,
  });

  return {
    ...copy,
    scenarios: copy.scenarios.map((scenario, index) => ({
      ...scenario,
      imageUrl: imageUrls[index],
    })),
  };
}
