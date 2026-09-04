import { AiError, openaiJson } from "./openai";
import { SCENARIO_SPECS, type ComposedCopy } from "./ai-types";
import type { CreativeFormat } from "./types";

export type { ComposedCopy, ComposedScenario } from "./ai-types";
export { SCENARIO_SPECS } from "./ai-types";

const SYSTEM = `Ты копирайтер Instagram-студии postvmeste.ru. Пишешь по-русски для экспертов: ясно, конкретно, без воды, без канцелярита, без markdown и без кавычек-ёлочек вокруг всего текста.
Короткий слайд читают за 2 секунды. Не используй эмодзи, кроме одного в CTA, если уместно.
Отвечай только JSON.`;

export async function draftExpertText(input: {
  topic: string;
  niche: string;
  tone?: string;
}): Promise<string> {
  const payload = await openaiJson<Record<string, unknown>>({
    system: SYSTEM,
    user: [
      "Напиши один редактируемый текст поста по теме.",
      "Это черновик, который человек потом правит. 6–10 коротких предложений, экспертный тон.",
      `Тема: ${input.topic}`,
      `Ниша: ${input.niche || "экспертный контент"}`,
      `Тон: ${input.tone || "спокойный и уверенный"}`,
      'Верни JSON: { "text": "..." }',
    ].join("\n"),
    timeoutMs: 45_000,
  });

  const text = pickText(payload);
  if (!text) throw new AiError("Модель вернула пустой текст. Попробуйте ещё раз.", 502);
  return text;
}

export async function composeVariantPreviews(input: {
  format: CreativeFormat;
  topic: string;
  text: string;
  niche: string;
  tone?: string;
}): Promise<ComposedCopy> {
  const source = input.text.trim();
  const payload = await openaiJson<Record<string, unknown>>({
    system: SYSTEM,
    user: [
      `Формат: ${formatLabel(input.format)}`,
      `Тема: ${input.topic}`,
      `Ниша: ${input.niche || "экспертный контент"}`,
      `Тон: ${input.tone || "спокойный и уверенный"}`,
      source
        ? `Исходный текст автора — не переписывай заново:\n${source}`
        : "Исходного текста нет — придумай короткий экспертный смысл.",
      "",
      "Это только выбор сценария. Ровно один слайд на сценарий. Не делай карусель из 7 слайдов.",
      input.format === "carousel"
        ? "Слайд = крючок/обложка. Остальные слайды карусели будут позже, после выбора человека."
        : "Этот слайд и есть готовый кадр публикации.",
      "",
      "Компактный JSON:",
      "- text: исходный текст или короткий черновик",
      `- caption: 2–4 предложения. ${input.format === "carousel" ? "Добавь «листайте»." : "Для поста это подпись к кадру."}`,
      "- hashtags: массив из 10 хештегов без пробелов",
      input.format === "reel" ? "- reelScript: хук и 4 тезиса к ролику" : "- reelScript опусти",
      "- scenarios: ровно 3 объекта, у каждого name и slides из ОДНОЙ короткой строки (до 80 символов)",
      "Смысл один, меняется только драматургия крючка.",
      ...SCENARIO_SPECS.map((spec) => `  • ${spec.name}: ${spec.hint.split(",")[0]}`),
      'Верни JSON: { "text", "caption", "hashtags", "reelScript", "scenarios": [{ "name", "slides": ["..."] }] }',
    ].join("\n"),
    timeoutMs: 60_000,
  });

  return normalizeComposedCopy(payload, {
    format: input.format,
    topic: input.topic,
    fallbackText: source,
    slideCount: 1,
  });
}

export async function expandCarouselSlides(input: {
  topic: string;
  text: string;
  niche: string;
  tone?: string;
  scenario: string;
  firstSlide: string;
}): Promise<string[]> {
  const source = input.text.trim();
  const spec = SCENARIO_SPECS.find((item) => item.name === input.scenario) || SCENARIO_SPECS[0];
  const payload = await openaiJson<Record<string, unknown>>({
    system: SYSTEM,
    user: [
      "Допиши карусель из 7 слайдов. Первый слайд уже выбран — не меняй его формулировку.",
      `Тема: ${input.topic}`,
      `Ниша: ${input.niche || "экспертный контент"}`,
      `Тон: ${input.tone || "спокойный и уверенный"}`,
      `Сценарий: ${spec.name}. ${spec.hint}`,
      `Первый слайд: ${input.firstSlide}`,
      source ? `Исходный текст:\n${source}` : "",
      "Слайды 2–6 — разбор по одной мысли, до 90 символов. Слайд 7 — CTA без ссылки.",
      'Верни JSON: { "slides": ["первый слайд как есть", "...", "...", "...", "...", "...", "CTA"] }',
    ].filter(Boolean).join("\n"),
    timeoutMs: 75_000,
  });

  return normalizeExpandedSlides(payload.slides, input.firstSlide, input.topic, source, spec.name);
}

export function normalizeComposedCopy(
  raw: Record<string, unknown>,
  opts: { format: CreativeFormat; topic: string; fallbackText?: string; slideCount?: number },
): ComposedCopy {
  const slideCount = opts.slideCount ?? 1;
  const text = pickText(raw) || opts.fallbackText?.trim() || "";
  const caption = String(raw.caption || "").trim() || defaultCaption(opts.topic, text, opts.format);
  const hashtags = normalizeHashtags(raw.hashtags);
  const reelScript = String(raw.reelScript || "").trim();
  const rawScenarios = Array.isArray(raw.scenarios) ? raw.scenarios : [];

  const scenarios = SCENARIO_SPECS.map((spec, index) => {
    const match =
      rawScenarios.find((item) => scenarioName(item) === spec.name) ||
      rawScenarios[index];
    const slides = normalizeSlides(match, slideCount, opts.topic, text, spec.name);
    return { name: spec.name, slides };
  });

  if (!text && !caption) {
    throw new AiError("Модель вернула пустой текст. Попробуйте ещё раз.", 502);
  }

  return {
    text: text || caption,
    caption,
    hashtags,
    reelScript: opts.format === "reel" ? reelScript || text || caption : undefined,
    scenarios,
  };
}

export function normalizeHashtags(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || "")
        .split(/[\s,]+/)
        .filter(Boolean);
  const tags = list
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => item.replace(/^#+/, "").replace(/\s+/g, ""))
    .filter((item) => item.length > 1 && item.length < 40)
    .map((item) => `#${item}`);
  const unique = [...new Set(tags)];
  const extras = [
    "#контент",
    "#экспертныйконтент",
    "#личныйбренд",
    "#instagram",
    "#полезныйконтент",
    "#карусель",
    "#советы",
    "#разбор",
    "#практика",
    "#ошибки",
    "#кейс",
    "#reels",
  ];
  for (const tag of extras) {
    if (unique.length >= 12) break;
    if (!unique.includes(tag)) unique.push(tag);
  }
  return unique.slice(0, 15);
}

function normalizeSlides(
  raw: unknown,
  count: number,
  topic: string,
  text: string,
  scenarioNameValue: string,
): string[] {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fromArray = Array.isArray(record.slides)
    ? record.slides
    : Array.isArray(raw)
      ? raw
      : [];
  const cleaned = fromArray
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const fallback = [topic, ...sentences, "Сохраните, чтобы не потерять →"];
  const slides = [...cleaned];
  while (slides.length < count) {
    slides.push(fallback[slides.length] || scenarioNameValue);
  }
  return slides.slice(0, count).map((item) => item.slice(0, 180));
}

export function normalizeExpandedSlides(
  raw: unknown,
  firstSlide: string,
  topic: string,
  text: string,
  scenarioNameValue: string,
): string[] {
  const slides = normalizeSlides({ slides: raw }, 7, topic, text, scenarioNameValue);
  slides[0] = firstSlide.replace(/\s+/g, " ").trim().slice(0, 180) || slides[0];
  return slides;
}

function pickText(payload: Record<string, unknown>) {
  const value = payload.text || payload.body || payload.draft;
  return typeof value === "string" ? value.trim() : "";
}

function scenarioName(raw: unknown) {
  if (!raw || typeof raw !== "object") return "";
  return String((raw as Record<string, unknown>).name || "").trim();
}

function formatLabel(format: CreativeFormat) {
  if (format === "carousel") return "карусель 1080×1350, на этом шаге только обложка сценария";
  if (format === "post") return "пост, один кадр 1080×1080";
  return "обложка Reels 1080×1920";
}

function defaultCaption(topic: string, text: string, format: CreativeFormat) {
  const intro =
    format === "carousel"
      ? `${topic}\n\nЛистайте карусель, чтобы узнать больше`
      : topic;
  const body = text ? `\n\n${text.slice(0, 400)}` : "";
  return `${intro}${body}`.trim();
}
