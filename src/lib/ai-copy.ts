import { AiError, openaiJson } from "./openai";
import { POST_SCENARIO_SPECS, REEL_SCENARIO_SPECS, SCENARIO_SPECS, scenarioSpecsFor, type ComposedCopy } from "./ai-types";
import type { CreativeFormat } from "./types";

export type { ComposedCopy, ComposedScenario } from "./ai-types";
export { POST_SCENARIO_SPECS, REEL_SCENARIO_SPECS, SCENARIO_SPECS, scenarioLabel, scenarioSpecsFor } from "./ai-types";

const SYSTEM = `Ты копирайтер Instagram-студии postvmeste.ru. Пишешь по-русски для экспертов: ясно, конкретно, без воды, без канцелярита, без markdown и без кавычек-ёлочек вокруг всего текста.
Короткий слайд читают за 2 секунды. Без эмодзи на слайдах. Слова «крючок», «разбор», «сценарий», «CTA» в текст слайдов не пиши — это внутренняя кухня.
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
    timeoutMs: 180_000,
  });

  const text = pickText(payload);
  if (!text) throw new AiError("Модель вернула пустой текст. Попробуйте ещё раз.", 502);
  return text;
}

export async function draftReelHooks(input: {
  topic: string;
  niche: string;
  tone?: string;
  authorHook?: string;
}): Promise<string[]> {
  const payload = await openaiJson<Record<string, unknown>>({
    system: SYSTEM,
    user: reelHookPrompt(input),
    timeoutMs: 180_000,
    maxTokens: 400,
  });
  return normalizeReelHooks(payload.hooks, input.topic, input.authorHook);
}

export function composeReelFromHooks(input: {
  topic: string;
  niche: string;
  hooks: string[];
  authorHook?: string;
}): ComposedCopy {
  const hooks = normalizeReelHooks(input.hooks, input.topic, input.authorHook);
  return {
    text: input.authorHook?.trim() || hooks[0],
    caption: input.topic,
    hashtags: localHashtags(input.topic, input.niche),
    reelScript: hooks[0],
    scenarios: REEL_SCENARIO_SPECS.map((spec, index) => ({
      name: spec.name,
      slides: [hooks[index]],
    })),
  };
}

export async function composeReelCopy(input: {
  topic: string;
  niche: string;
  tone?: string;
  authorHook?: string;
}): Promise<ComposedCopy> {
  const hooks = await draftReelHooks(input);
  return composeReelFromHooks({
    topic: input.topic,
    niche: input.niche,
    hooks,
    authorHook: input.authorHook,
  });
}

export async function composeVariantPreviews(input: {
  format: CreativeFormat;
  topic: string;
  text: string;
  niche: string;
  tone?: string;
}): Promise<ComposedCopy> {
  if (input.format === "post") return composePostFromAuthorText(input);
  if (input.format === "reel") {
    return composeReelCopy({
      topic: input.topic,
      niche: input.niche,
      tone: input.tone,
      authorHook: input.text,
    });
  }

  const source = input.text.trim();
  const excerpt = source.slice(0, 700);
  const payload = await openaiJson<Record<string, unknown>>({
    system: SYSTEM,
    user: [
      `Тема: ${input.topic}`,
      `Ниша: ${input.niche || "экспертный контент"}`,
      `Тон: ${input.tone || "спокойный и уверенный"}`,
      excerpt ? `Опора (не пересказывать целиком):\n${excerpt}` : "",
      "Нужны только 3 коротких крючка, по одному на заход. Каждый до 70 символов.",
      "Служебные имена в JSON оставь как есть. В текст крючка их не пиши.",
      ...SCENARIO_SPECS.map((spec) => `- ${spec.name} (${spec.label})`),
      'JSON: { "scenarios": [{ "name": "...", "slides": ["крючок"] }] }',
    ].filter(Boolean).join("\n"),
    timeoutMs: 180_000,
    maxTokens: 500,
  });

  return normalizeComposedCopy(
    {
      ...payload,
      text: source,
      caption: defaultCaption(input.topic, source, input.format),
      hashtags: localHashtags(input.topic, input.niche),
      reelScript: undefined,
    },
    {
      format: input.format,
      topic: input.topic,
      fallbackText: source,
      slideCount: 1,
    },
  );
}

export function composePostFromAuthorText(input: {
  topic: string;
  text: string;
  niche: string;
}): ComposedCopy {
  const source = input.text.trim();
  const caption = source || input.topic;
  return {
    text: source,
    caption,
    hashtags: localHashtags(input.topic, input.niche),
    scenarios: POST_SCENARIO_SPECS.map((spec) => ({
      name: spec.name,
      slides: [""],
      caption,
    })),
  };
}

export async function expandCarouselSlides(input: {
  topic: string;
  text: string;
  niche: string;
  tone?: string;
  scenario: string;
  firstSlide: string;
}): Promise<{ slides: string[]; caption: string; hashtags: string[] }> {
  const source = input.text.trim();
  const spec = SCENARIO_SPECS.find((item) => item.name === input.scenario) || SCENARIO_SPECS[0];
  const payload = await openaiJson<Record<string, unknown>>({
    system: SYSTEM,
    user: [
      "Допиши карусель из 7 слайдов. Первый слайд уже выбран — не меняй его формулировку.",
      `Тема: ${input.topic}`,
      `Ниша: ${input.niche || "экспертный контент"}`,
      `Тон: ${input.tone || "спокойный и уверенный"}`,
      `Заход: ${spec.label}. ${spec.hint}`,
      `Первый слайд: ${input.firstSlide}`,
      source ? `Исходный текст:\n${source}` : "",
      "Слайды 2–6 — не пять афоризмов на одну мысль. У каждого слайда свой ход, до 90 символов.",
      "Не повторяй формулировку первого слайда. Без эмодзи. Без слов «крючок», «разбор», «сценарий», «CTA».",
      "Слайд 7 — призыв сохранить или написать один конкретный ответ. Без эмодзи, без ссылки.",
      "Плюс подпись к публикации: 4–7 коротких предложений. Первая строка перекликается с хуком первого слайда.",
      "Ёмко раскрыть мысль карусели, без лонгрида, без markdown, без списка хештегов внутри caption.",
      "10–15 хештегов отдельно.",
      'JSON: { "slides": ["первый слайд как есть", "...", "...", "...", "...", "...", "CTA"], "caption": "...", "hashtags": ["#тема"] }',
    ].filter(Boolean).join("\n"),
    timeoutMs: 180_000,
    maxTokens: 1600,
  });

  const slides = normalizeExpandedSlides(payload.slides, input.firstSlide, input.topic, source, spec.name);
  return {
    slides,
    caption: normalizeCarouselCaption(payload.caption, input.topic, slides),
    hashtags: normalizeHashtags(payload.hashtags).length
      ? normalizeHashtags(payload.hashtags)
      : localHashtags(input.topic, input.niche),
  };
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
  const specs = scenarioSpecsFor(opts.format);
  const fallbackCaption = caption;

  const scenarios = specs.map((spec, index) => {
    const match =
      rawScenarios.find((item) => scenarioName(item) === spec.name) ||
      rawScenarios[index];
    const slides = normalizeSlides(match, slideCount, opts.topic, text, spec.name);
    const scenarioCaption = pickScenarioCaption(match);
    return {
      name: spec.name,
      slides,
      caption: opts.format === "post"
        ? scenarioCaption || fallbackCaption || defaultCaption(opts.topic, text, "post")
        : undefined,
    };
  });

  if (!text && !caption) {
    throw new AiError("Модель вернула пустой текст. Попробуйте ещё раз.", 502);
  }

  return {
    text: text || caption,
    caption: opts.format === "post"
      ? scenarios[0]?.caption || caption
      : caption,
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
    slides.push(fallback[slides.length] || "Сохраните, чтобы не потерять");
  }
  return slides.slice(0, count).map((item) => item.slice(0, 180));
}

export function normalizeCarouselCaption(raw: unknown, topic: string, slides: string[]) {
  const text = String(raw || "").replace(/\s+\n/g, "\n").trim();
  if (text) return text.slice(0, 900);
  const hook = slides[0] || topic;
  const body = slides.slice(1, 4).filter(Boolean).join(" ");
  return `${hook}\n\n${body}`.trim().slice(0, 900);
}

export function normalizeExpandedSlides(
  raw: unknown,
  firstSlide: string,
  topic: string,
  text: string,
  scenarioNameValue: string,
): string[] {
  const slides = normalizeSlides({ slides: raw }, 7, topic, text, scenarioNameValue)
    .map((item) => stripSlideDecor(item));
  slides[0] = stripSlideDecor(firstSlide.replace(/\s+/g, " ").trim().slice(0, 180) || slides[0]);
  return slides;
}

export function stripSlideDecor(value: string) {
  return value
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickText(payload: Record<string, unknown>) {
  const value = payload.text || payload.body || payload.draft;
  return typeof value === "string" ? value.trim() : "";
}

function scenarioName(raw: unknown) {
  if (!raw || typeof raw !== "object") return "";
  return String((raw as Record<string, unknown>).name || "").trim();
}

function pickScenarioCaption(raw: unknown) {
  if (!raw || typeof raw !== "object") return "";
  return String((raw as Record<string, unknown>).caption || "").replace(/\s+\n/g, "\n").trim().slice(0, 2200);
}

function localHashtags(topic: string, niche: string) {
  const words = `${topic} ${niche}`
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 6);
  return normalizeHashtags(words);
}

export function normalizeReelHooks(raw: unknown, topic: string, authorHook?: string): string[] {
  const fromArray = Array.isArray(raw) ? raw : [];
  const cleaned = fromArray
    .map((item) => normalizeReelHook(item))
    .filter(Boolean);
  const fallbacks = [
    normalizeReelHook(topic) || "Смотрите до конца",
    "Ошибку, о которой молчат",
    "Один шаг вместо десяти",
  ];
  const hooks = [...cleaned];
  while (hooks.length < 3) {
    const next = fallbacks[hooks.length];
    if (!hooks.includes(next)) hooks.push(next);
    else hooks.push(`${fallbacks[0]} ${hooks.length + 1}`);
  }
  const author = normalizeReelHook(authorHook || "");
  if (author) hooks[0] = author;
  return hooks.slice(0, 3);
}

function normalizeReelHook(value: unknown) {
  const words = String(value || "")
    .replace(/[«»""]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 6);
  return words.join(" ").replace(/[.,;:]+$/, "").slice(0, 48);
}

function reelHookPrompt(input: {
  topic: string;
  niche: string;
  tone?: string;
  authorHook?: string;
}) {
  return [
    "Нужны 3 хука на обложку Reels. Это не сценарий ролика и не подпись поста.",
    "Каждый хук — 3–6 слов, без эмодзи, без кавычек, без точки в конце, если это не вопрос.",
    "Первые три слова должны цеплять. Конкретика сильнее общих советов.",
    `Тема ролика: ${input.topic}`,
    `Ниша: ${input.niche || "экспертный контент"}`,
    input.tone ? `Тон: ${input.tone}` : "",
    input.authorHook?.trim()
      ? `Хук автора сохрани как первый, смысл не переписывай: ${input.authorHook.trim()}`
      : "",
    "Три угла:",
    ...REEL_SCENARIO_SPECS.map((spec) => `- ${spec.name}: ${spec.hint}`),
    'JSON: { "hooks": ["провокация", "дыра", "обещание"] }',
  ].filter(Boolean).join("\n");
}

function defaultCaption(topic: string, text: string, format: CreativeFormat) {
  const intro =
    format === "carousel"
      ? `${topic}\n\nЛистайте карусель, чтобы узнать больше`
      : topic;
  const body = text ? `\n\n${text.slice(0, 400)}` : "";
  return `${intro}${body}`.trim();
}
