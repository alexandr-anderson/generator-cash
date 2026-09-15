import { POST_SCENARIO_SPECS, REEL_SCENARIO_SPECS } from "./ai-types";
import { buildPostImagePrompt, buildReelImagePrompt } from "./ai-image-prompt";
import { createImagesWithFallback, detectImageMime } from "./image-fallback";
import { AiError, openaiImagePng, openaiVisualBrief } from "./openai";
import { filePublicPath, readUserFile, saveUserBuffer } from "./storage";
import { prisma } from "./db";

export { buildPostImagePrompt, buildReelImagePrompt } from "./ai-image-prompt";

export async function attachPostImages(input: {
  userId: string;
  rubricId?: string | null;
  topic: string;
  niche: string;
  tone?: string;
  text: string;
  colors?: string[];
  referenceIds?: string[];
}): Promise<string[]> {
  const references = await loadReferenceImages(input.userId, input.referenceIds || []);
  const visualBrief = await openaiVisualBrief({
    topic: input.topic,
    niche: input.niche,
    images: references,
  });

  const pngs = await createImagesWithFallback(POST_SCENARIO_SPECS.map((spec) => {
    const prompt = buildPostImagePrompt({
      topic: input.topic,
      niche: input.niche,
      tone: input.tone,
      angle: spec.name,
      hint: spec.hint,
      colors: input.colors,
      visualBrief,
      textExcerpt: input.text.trim(),
    });
    return {
      prompt,
      size: "1024x1024" as const,
      primary: () => openaiImagePng({ prompt }),
      scene: {
        topic: input.topic,
        niche: input.niche,
        tone: input.tone,
        angle: spec.name,
        hint: spec.hint,
        colors: input.colors,
        visualBrief,
        format: "square" as const,
      },
    };
  }));

  const saved = [];
  for (const png of pngs) {
    if (!png.length) {
      throw new AiError("Модель вернула пустую картинку. Попробуйте ещё раз.", 502);
    }
    saved.push(await saveUserBuffer({
      userId: input.userId,
      rubricId: input.rubricId,
      kind: "export",
      buffer: png,
      mimeType: detectImageMime(png) || "image/png",
    }));
  }

  return saved.map((file) => filePublicPath(file.id));
}

export async function attachReelImages(input: {
  userId: string;
  rubricId?: string | null;
  topic: string;
  niche: string;
  tone?: string;
  colors?: string[];
  referenceIds?: string[];
}): Promise<string[]> {
  const references = await loadReferenceImages(input.userId, input.referenceIds || []);
  const visualBrief = await openaiVisualBrief({
    topic: input.topic,
    niche: input.niche,
    images: references,
  });

  const pngs = await createImagesWithFallback(REEL_SCENARIO_SPECS.map((spec) => {
    const prompt = buildReelImagePrompt({
      topic: input.topic,
      niche: input.niche,
      tone: input.tone,
      angle: spec.name,
      hint: spec.hint,
      colors: input.colors,
      visualBrief,
    });
    return {
      prompt,
      size: "1024x1792" as const,
      primary: () => generateReelPng(prompt),
      scene: {
        topic: input.topic,
        niche: input.niche,
        tone: input.tone,
        angle: spec.name,
        hint: spec.hint,
        colors: input.colors,
        visualBrief,
        format: "vertical" as const,
      },
    };
  }));

  const saved = [];
  for (const png of pngs) {
    if (!png.length) {
      throw new AiError("Модель вернула пустую картинку. Попробуйте ещё раз.", 502);
    }
    saved.push(await saveUserBuffer({
      userId: input.userId,
      rubricId: input.rubricId,
      kind: "export",
      buffer: png,
      mimeType: detectImageMime(png) || "image/png",
    }));
  }

  return saved.map((file) => filePublicPath(file.id));
}

async function generateReelPng(prompt: string) {
  try {
    return await openaiImagePng({ prompt, size: "1024x1792" });
  } catch (error) {
    console.error("[ai-image] reel 9:16 failed, retry square", error);
    return openaiImagePng({ prompt, size: "1024x1024" });
  }
}

export async function loadReferenceImages(userId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 4);
  if (!unique.length) return [];
  const files = await prisma.fileAsset.findMany({
    where: { userId, id: { in: unique }, kind: "reference" },
  });
  const images = [];
  for (const file of files) {
    try {
      images.push({
        mimeType: file.mimeType,
        bytes: await readUserFile(file.objectKey),
      });
    } catch (error) {
      console.error("[ai-image] skip reference", file.id, error);
    }
  }
  return images;
}
