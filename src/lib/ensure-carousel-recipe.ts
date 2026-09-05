import { loadReferenceImages } from "./ai-image";
import {
  isRecipeStale,
  normalizeCarouselRecipe,
  type CarouselRecipe,
} from "./carousel-recipe";
import { prisma } from "./db";
import { openaiCarouselRecipe } from "./openai";

export async function ensureCarouselRecipe(input: {
  userId: string;
  rubricId?: string | null;
  referenceIds: string[];
}): Promise<CarouselRecipe | null> {
  if (!input.rubricId || !input.referenceIds.length) return null;

  const rubric = await prisma.rubric.findFirst({
    where: { id: input.rubricId, userId: input.userId },
  });
  if (!rubric) return null;

  const existing = normalizeStoredRecipe(rubric.carouselRecipe, input.referenceIds);
  if (existing && !isRecipeStale(existing, input.referenceIds)) {
    return existing;
  }

  const images = await loadReferenceImages(input.userId, input.referenceIds.slice(0, 2));
  if (!images.length) return null;

  const raw = await openaiCarouselRecipe({ images });
  if (!raw) return null;

  const recipe = normalizeCarouselRecipe(raw, input.referenceIds);
  await prisma.rubric.update({
    where: { id: rubric.id },
    data: { carouselRecipe: recipe },
  });
  return recipe;
}

function normalizeStoredRecipe(raw: unknown, fallbackIds: string[]) {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const sourceFileIds = Array.isArray(record.sourceFileIds)
    ? record.sourceFileIds.filter((item): item is string => typeof item === "string")
    : fallbackIds;
  return normalizeCarouselRecipe(record, sourceFileIds);
}
