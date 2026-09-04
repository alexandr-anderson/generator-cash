import type { ComposedCopy } from "./ai-types";
import { SCENARIO_SPECS } from "./ai-types";
import type { CreativeFormat, CreativeLayout, CreativeWork, Rubric, SlideContent, UserProfile } from "./types";

const SCENARIOS = SCENARIO_SPECS.map((spec, index) => ({
  name: spec.name,
  structure: index === 1
    ? ["myth", "truth", "truth", "truth", "truth", "amplify", "cta"]
    : index === 2
      ? ["mistake", "fix", "fix", "fix", "fix", "amplify", "cta"]
      : ["hook", "point", "point", "point", "point", "amplify", "cta"],
}));

const LAYOUTS: CreativeLayout[] = ["poster", "band", "centered"];


function generateSlideTexts(topic: string, text: string, scenario: typeof SCENARIOS[0]): string[] {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return scenario.structure.map((type, i) => {
    if (type === "hook") return topic;
    if (type === "cta") return "Сохраните, чтобы не потерять →";
    if (type === "amplify") return sentences[Math.min(i, sentences.length - 1)] || "Попробуйте сегодня";
    return sentences[Math.min(i - 1, sentences.length - 1)] || `Мысль ${i}`;
  });
}

function pickColors(rubric: Rubric | undefined, profile: UserProfile | null, userColors: string[]): { bg: string; fg: string; accent: string } {
  const colors = userColors.length >= 3
    ? userColors
    : rubric?.colors?.length
      ? rubric.colors
      : profile?.colors?.length
        ? profile.colors
        : ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"];

  return {
    bg: colors[2] || "#f6f1e9",
    fg: colors[3] || "#191817",
    accent: colors[0] || "#ff5c35",
  };
}

export function generateVariants(
  format: CreativeFormat,
  topic: string,
  text: string,
  rubric: Rubric | undefined,
  profile: UserProfile | null,
  userColors: string[],
  copy?: ComposedCopy,
): CreativeWork[] {
  const { bg, fg, accent } = pickColors(rubric, profile, userColors);

  return SCENARIOS.map((scenario, i) => {
    const layout = LAYOUTS[i % LAYOUTS.length];
    const aiSlides = copy?.scenarios[i]?.slides;
    const slideTexts = aiSlides?.length
      ? aiSlides
      : format === "carousel"
        ? generateSlideTexts(topic, text, scenario)
        : [topic];

    const slides: SlideContent[] = slideTexts.map((t) => ({
      text: t,
      fontSize: format === "reel" ? 64 : 48,
      textColor: fg,
      positionX: 50,
      positionY: 50,
    }));

    const hashtags = copy?.hashtags?.length
      ? copy.hashtags
      : generateHashtags(topic, profile?.niche || "");

    return {
      id: crypto.randomUUID(),
      format,
      rubricId: rubric?.id || "",
      topic,
      slides,
      caption: copy?.caption || generateCaption(topic, text, format),
      hashtags,
      reelScript: copy?.reelScript,
      layout,
      background: i === 1 ? fg : bg,
      accent,
      foreground: i === 1 ? bg : fg,
      eyebrow: copy?.scenarios[i]?.name || scenario.name,
      brandLabel: profile?.email?.split("@")[0] || "postvmeste",
      createdAt: Date.now(),
    };
  });
}

export function applySlideTexts(work: CreativeWork, texts: string[]): CreativeWork {
  const template = work.slides[0] || {
    text: "",
    fontSize: work.format === "reel" ? 64 : 48,
    textColor: work.foreground,
    positionX: 50,
    positionY: 50,
  };
  return {
    ...work,
    slides: texts.map((text, index) => ({
      ...(work.slides[index] || template),
      text,
    })),
  };
}

function generateCaption(topic: string, text: string, format: CreativeFormat): string {
  const intro = format === "carousel"
    ? `${topic}\n\nЛистайте карусель, чтобы узнать больше 👇`
    : `${topic}`;
  const body = text ? `\n\n${text.slice(0, 300)}` : "";
  return `${intro}${body}\n\nСохраните, чтобы не потерять 💾`;
}

function generateHashtags(topic: string, niche: string): string[] {
  const words = `${topic} ${niche}`.toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const base = ["контент", "экспертныйконтент", "личныйбренд", "instagram", "полезныйконтент"];
  const topicTags = words.slice(0, 5).map((w) => w.replace(/\s/g, ""));
  const all = [...new Set([...topicTags, ...base])].slice(0, 15);
  return all.map((t) => `#${t}`);
}

export function generateText(topic: string, niche: string, tone?: string): string {
  const toneLabel = tone || "спокойный и уверенный";
  return [
    `${topic} — тема, которая волнует многих.`,
    `Как эксперт в области «${niche}», я часто вижу одни и те же вопросы.`,
    `Давайте разберём основные моменты.`,
    `Первое, на что стоит обратить внимание — это базовые принципы.`,
    `Второе — практическое применение в вашей ситуации.`,
    `Третье — типичные ошибки, которых можно избежать.`,
    `И наконец, конкретный план действий, который вы можете начать прямо сейчас.`,
    `Тон: ${toneLabel}.`,
  ].join(" ");
}
