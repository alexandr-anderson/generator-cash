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

export async function composeExpertCopy(input: {
  format: CreativeFormat;
  topic: string;
  text: string;
  niche: string;
  tone?: string;
}): Promise<ComposedCopy> {
  const slideCount = input.format === "carousel" ? 7 : 1;
  const source = input.text.trim();
  const payload = await openaiJson<Record<string, unknown>>({
    system: SYSTEM,
    user: [
      `Формат: ${formatLabel(input.format)}`,
      `Тема: ${input.topic}`,
      `Ниша: ${input.niche || "экспертный контент"}`,
      `Тон: ${input.tone || "спокойный и уверенный"}`,
      source
        ? `Исходный текст автора — не переписывай заново, только слегка вычитай и разложи:\n${source}`
        : "Исходного текста нет — напиши короткий экспертный текст и разложи его.",
      "",
      "Нужно компактный JSON, без воды:",
      "- text: верни исходный текст (или короткий черновик, если исходника не было)",
      `- caption: 2–4 предложения подписи. Для карусели добавь «листайте».`,
      "- hashtags: массив из 10 хештегов без пробелов внутри",
      input.format === "reel"
        ? "- reelScript: хук и 4 тезиса к ролику"
        : "- reelScript можно опустить",
      `- scenarios: ровно 3 объекта. У каждого name из списка ниже и slides: ровно ${slideCount} коротких строк.`,
      "Смысл один, меняется только драматургия.",
      ...SCENARIO_SPECS.map((spec) => `  • ${spec.name}: ${spec.hint}`),
      input.format === "carousel"
        ? "Каждый слайд — 1 мысль, до 90 символов, без нумерации «слайд 1»."
        : "Единственный слайд — сильный заголовок, до 80 символов.",
      "CTA на последнем слайде карусели: сохранить / написать в директ / попробовать, без ссылок.",
      'Верни JSON: { "text", "caption", "hashtags", "reelScript", "scenarios": [{ "name", "slides": [] }] }',
    ].join("\n"),
    timeoutMs: 120_000,
  });

  return normalizeComposedCopy(payload, {
    format: input.format,
    topic: input.topic,
    fallbackText: source,
  });
}

export function normalizeComposedCopy(
  raw: Record<string, unknown>,
  opts: { format: CreativeFormat; topic: string; fallbackText?: string },
): ComposedCopy {
  const slideCount = opts.format === "carousel" ? 7 : 1;
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

function pickText(payload: Record<string, unknown>) {
  const value = payload.text || payload.body || payload.draft;
  return typeof value === "string" ? value.trim() : "";
}

function scenarioName(raw: unknown) {
  if (!raw || typeof raw !== "object") return "";
  return String((raw as Record<string, unknown>).name || "").trim();
}

function formatLabel(format: CreativeFormat) {
  if (format === "carousel") return "карусель, 7 слайдов 1080×1350";
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
