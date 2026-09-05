import type {
  FileAsset,
  Rubric,
  RubricTemplate,
  UsageState,
  User,
  Work,
} from "@prisma/client";
import type {
  ArchiveItem,
  CreativeFormat,
  CreativeWork,
  Rubric as ClientRubric,
  SlideContent,
  Subscription,
  Template,
  UserProfile,
} from "./types";
import { remainingFromUsage, totalFromUsage } from "./quota";
import { DETACHED_RUBRIC_LABEL } from "./rubric-copy";
import { filePublicPath } from "./storage";

type RubricWith = Rubric & { templates: RubricTemplate[]; files: FileAsset[] };

export function toUserProfile(user: User, logoId?: string | null): UserProfile {
  const colors = Array.isArray(user.colors) ? (user.colors as string[]) : undefined;
  return {
    id: user.id,
    email: user.email,
    niche: user.niche,
    audience: user.audience || undefined,
    tone: user.tone || undefined,
    colors,
    logoUrl: logoId ? filePublicPath(logoId) : user.logoFileId ? filePublicPath(user.logoFileId) : undefined,
    profileCompleted: user.profileCompleted,
    profilePopupShown: user.profilePopupShown,
    role: user.role === "admin" ? "admin" : "user",
  };
}

export function toSubscription(usage: UsageState | null | undefined): Subscription {
  if (!usage) {
    return {
      tier: "free",
      generationsPerWeek: 1,
      priceRub: 0,
      generationsUsed: 0,
      weekStartedAt: Date.now(),
      initialFreeRemaining: 5,
    };
  }
  return {
    tier: usage.tier,
    generationsPerWeek: usage.generationsPerWeek,
    priceRub: usage.priceRub,
    generationsUsed: usage.generationsUsed,
    weekStartedAt: usage.weekStartedAt.getTime(),
    initialFreeRemaining: usage.initialFreeRemaining,
  };
}

export function toRubric(rubric: RubricWith): ClientRubric {
  const templates: ClientRubric["templates"] = {};
  for (const item of rubric.templates) {
    templates[item.format] = {
      layout: item.layout as Template["layout"],
      scenario: item.scenario,
      decorStyle: item.decorStyle,
      font: item.font,
      colors: Array.isArray(item.colors) ? (item.colors as string[]) : [],
      slideCount: item.slideCount,
    };
  }
  return {
    id: rubric.id,
    name: rubric.name,
    colors: Array.isArray(rubric.colors) ? (rubric.colors as string[]) : undefined,
    references: rubric.files
      .filter((file) => file.kind === "reference")
      .map((file) => filePublicPath(file.id)),
    inspirationUrl: rubric.inspirationUrl || undefined,
    templates: Object.keys(templates).length ? templates : undefined,
    createdAt: rubric.createdAt.getTime(),
  };
}

export function toWork(work: Work): CreativeWork {
  return {
    id: work.id,
    format: work.format,
    rubricId: work.rubricId,
    topic: work.topic,
    slides: work.slides as SlideContent[],
    caption: work.caption,
    hashtags: Array.isArray(work.hashtags) ? (work.hashtags as string[]) : [],
    reelScript: work.reelScript || undefined,
    layout: work.layout as CreativeWork["layout"],
    background: work.background,
    accent: work.accent,
    foreground: work.foreground,
    eyebrow: work.eyebrow,
    brandLabel: work.brandLabel,
    createdAt: work.createdAt.getTime(),
  };
}

export function toArchive(work: Work, rubricName: string): ArchiveItem {
  const slides = work.slides as SlideContent[];
  return {
    id: `archive-${work.id}`,
    workId: work.id,
    format: work.format,
    rubricId: work.rubricId,
    rubricName,
    topic: work.topic,
    previewSlide: slides[0],
    background: work.background,
    createdAt: work.createdAt.getTime(),
  };
}

export function studioPayload(input: {
  user: User;
  usage: UsageState | null;
  rubrics: RubricWith[];
  works: (Work & { rubric: { name: string } | null })[];
}) {
  const works = input.works.map(toWork);
  return {
    user: toUserProfile(input.user),
    subscription: toSubscription(input.usage),
    remaining: remainingFromUsage(input.usage),
    total: totalFromUsage(input.usage),
    rubrics: input.rubrics.map(toRubric),
    works,
    archive: input.works.map((work) => toArchive(work, work.rubric?.name || DETACHED_RUBRIC_LABEL)),
  };
}

export function isFormat(value: string): value is CreativeFormat {
  return value === "carousel" || value === "post" || value === "reel";
}
