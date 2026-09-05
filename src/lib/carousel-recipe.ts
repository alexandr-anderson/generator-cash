import type { CreativeLayout } from "./types";

export type CarouselPaper = "light" | "dark";
export type CarouselDecor = "blob" | "band-top" | "dot" | "rail" | "none";
export type CarouselCloser = "accent" | "split";
export type CarouselAlign = "left" | "center";

export type CarouselRecipe = {
  version: 1;
  sourceFileIds: string[];
  family: CreativeLayout;
  align: CarouselAlign;
  paper: CarouselPaper;
  decor: CarouselDecor;
  decorX: number;
  decorY: number;
  decorScale: number;
  textY: number;
  showIndex: boolean;
  closer: CarouselCloser;
};

const FAMILIES = new Set<CreativeLayout>(["poster", "band", "centered"]);
const DECORS = new Set<CarouselDecor>(["blob", "band-top", "dot", "rail", "none"]);

export function recipeSourceKey(ids: string[]) {
  return [...new Set(ids.filter(Boolean))].sort().join(",");
}

export function isRecipeStale(recipe: CarouselRecipe | null | undefined, fileIds: string[]) {
  if (!recipe) return true;
  return recipeSourceKey(recipe.sourceFileIds) !== recipeSourceKey(fileIds);
}

export function defaultCarouselRecipe(layout: CreativeLayout, sourceFileIds: string[] = []): CarouselRecipe {
  if (layout === "band") {
    return {
      version: 1,
      sourceFileIds,
      family: "band",
      align: "left",
      paper: "dark",
      decor: "band-top",
      decorX: 50,
      decorY: 7,
      decorScale: 1,
      textY: 32,
      showIndex: true,
      closer: "split",
    };
  }
  if (layout === "centered") {
    return {
      version: 1,
      sourceFileIds,
      family: "centered",
      align: "center",
      paper: "light",
      decor: "dot",
      decorX: 50,
      decorY: 18,
      decorScale: 1,
      textY: 42,
      showIndex: true,
      closer: "accent",
    };
  }
  return {
    version: 1,
    sourceFileIds,
    family: "poster",
    align: "left",
    paper: "light",
    decor: "blob",
    decorX: 86,
    decorY: 10,
    decorScale: 1,
    textY: 40,
    showIndex: true,
    closer: "accent",
  };
}

export function normalizeCarouselRecipe(raw: unknown, sourceFileIds: string[]): CarouselRecipe {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const family = FAMILIES.has(record.family as CreativeLayout)
    ? record.family as CreativeLayout
    : "poster";
  const base = defaultCarouselRecipe(family, sourceFileIds);
  const decor = DECORS.has(record.decor as CarouselDecor)
    ? record.decor as CarouselDecor
    : base.decor;
  return {
    version: 1,
    sourceFileIds,
    family,
    align: record.align === "center" ? "center" : "left",
    paper: record.paper === "dark" ? "dark" : "light",
    decor,
    decorX: clampNumber(record.decorX, base.decorX, 8, 92),
    decorY: clampNumber(record.decorY, base.decorY, 4, 48),
    decorScale: clampNumber(record.decorScale, base.decorScale, 0.7, 1.35),
    textY: clampNumber(record.textY, base.textY, 28, 58),
    showIndex: record.showIndex !== false,
    closer: record.closer === "split" ? "split" : "accent",
  };
}

export function recipeForWork(work: { layout: CreativeLayout; recipe?: CarouselRecipe }) {
  return work.recipe || defaultCarouselRecipe(work.layout);
}

export function nudgeCarouselRecipe(recipe: CarouselRecipe, seed: string): CarouselRecipe {
  const hash = hashSeed(seed);
  return {
    ...recipe,
    decorX: clamp(recipe.decorX + ((hash % 13) - 6), 8, 92),
    decorY: clamp(recipe.decorY + (((hash >> 4) % 11) - 5), 4, 48),
    decorScale: clamp(Number((recipe.decorScale * (1 + ((((hash >> 8) % 9) - 4) * 0.02))).toFixed(2)), 0.7, 1.35),
    textY: clamp(recipe.textY + (((hash >> 12) % 7) - 3), 28, 58),
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, min, max);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash || 1;
}
