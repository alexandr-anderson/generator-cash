import { POST_SCENARIO_SPECS } from "./ai-types";
import { buildPostImagePrompt } from "./ai-image-prompt";
import { AiError, openaiImagePng, openaiVisualBrief } from "./openai";
import { filePublicPath, readUserFile, saveUserBuffer } from "./storage";
import { prisma } from "./db";

export { buildPostImagePrompt } from "./ai-image-prompt";

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

  const pngs = [];
  for (const spec of POST_SCENARIO_SPECS) {
    pngs.push(await openaiImagePng({
      prompt: buildPostImagePrompt({
        topic: input.topic,
        niche: input.niche,
        tone: input.tone,
        angle: spec.name,
        hint: spec.hint,
        colors: input.colors,
        visualBrief,
        textExcerpt: input.text.trim(),
      }),
    }));
  }

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
      mimeType: "image/png",
    }));
  }

  return saved.map((file) => filePublicPath(file.id));
}

async function loadReferenceImages(userId: string, ids: string[]) {
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
