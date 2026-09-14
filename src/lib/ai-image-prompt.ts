export function buildPostImagePrompt(input: {
  topic: string;
  niche: string;
  tone?: string;
  angle: string;
  hint: string;
  colors?: string[];
  visualBrief?: string;
  textExcerpt?: string;
}) {
  const palette = (input.colors || []).filter(Boolean).slice(0, 4).join(", ");
  return [
    "Square Instagram photograph, 1:1, editorial, specific, not generic stock.",
    "Absolutely no text, letters, numbers, logos, watermarks, captions, UI, posters, or typography of any kind.",
    `Niche: ${input.niche || "экспертный контент"}.`,
    `Theme to metaphorize, not illustrate as a quote: ${input.topic}.`,
    `Visual angle «${input.angle}»: ${input.hint}`,
    input.tone ? `Mood: ${input.tone}.` : "",
    palette ? `Color mood inspired by ${palette}, without printing the hex on the image.` : "",
    input.visualBrief ? `Author visual language:\n${input.visualBrief}` : "",
    input.textExcerpt
      ? `Optional mood from the draft, never paint these words:\n${input.textExcerpt.slice(0, 280)}`
      : "",
    "No people holding signs. No screens with readable copy. Just a picture.",
  ].filter(Boolean).join("\n");
}

export function buildReelImagePrompt(input: {
  topic: string;
  niche: string;
  tone?: string;
  angle: string;
  hint: string;
  colors?: string[];
  visualBrief?: string;
}) {
  const palette = (input.colors || []).filter(Boolean).slice(0, 4).join(", ");
  return [
    "Vertical Instagram photograph, 9:16 feel, subject centered, editorial, specific, not generic stock.",
    "Absolutely no text, letters, numbers, logos, watermarks, captions, UI, posters, or typography of any kind.",
    `Niche: ${input.niche || "экспертный контент"}.`,
    `Reel theme to metaphorize, not write as a quote: ${input.topic}.`,
    `Visual angle «${input.angle}»: ${input.hint}`,
    input.tone ? `Mood: ${input.tone}.` : "",
    palette ? `Color mood inspired by ${palette}, without printing the hex on the image.` : "",
    input.visualBrief
      ? `Author visual language from their reel stills. Keep a real person recognizable if they appear. Do not invent a different face.\n${input.visualBrief}`
      : "If no author still exists, invent a concrete metaphor of the theme. Prefer objects and places over stock smiling portraits.",
    "No people holding signs. No phones with readable screens. Just a picture that can carry a short hook on top.",
  ].filter(Boolean).join("\n");
}

export type ImageSceneInput = {
  topic: string;
  niche: string;
  tone?: string;
  angle: string;
  hint: string;
  colors?: string[];
  visualBrief?: string;
  format: "square" | "vertical";
};

/**
 * Запрос к текстовой модели: переписать задачу картинки в промпт для запасной
 * модели (п. 50 в docs/work-plan.md).
 *
 * Зачем отдельно: промпты выше написаны под gpt-image — они держатся на запретах
 * («no text», «no people holding signs») и русской теме. Диффузионные модели
 * читают это буквально: по нашему промпту поста 2026-09-14 z-image-turbo напечатала
 * тему с опечатками на карточке, а flux нарисовал толпу с плакатами. Такой модели
 * нужна одна конкретная сцена по-английски, только то, что есть в кадре.
 */
export function buildImageSceneRequest(input: ImageSceneInput) {
  const palette = (input.colors || []).filter(Boolean).slice(0, 4).join(", ");
  const system = [
    "You write prompts for a diffusion image model that cannot read instructions or negations.",
    "Describe ONE concrete photographic scene that works as a visual metaphor for the theme.",
    "English only, 1-2 sentences, max 60 words. Describe only what IS in the frame: objects, place, light, colors, composition, camera.",
    "Never mention words, letters, text, signs, posters, screens, books with titles, people holding anything written. Never use the words 'no', 'without', 'not'.",
    "Colors may come as hex codes: name them as plain color words.",
    "Prefer objects and places over people. Answer as JSON: {\"scene\": \"...\"}",
  ].join("\n");
  const user = [
    `Theme (Russian): ${input.topic}`,
    `Niche: ${input.niche || "экспертный контент"}`,
    `Visual angle «${input.angle}»: ${input.hint}`,
    input.tone ? `Mood: ${input.tone}` : "",
    palette ? `Color palette: ${palette}` : "",
    input.visualBrief ? `Author visual language (Russian):\n${input.visualBrief}` : "",
    `Format: ${input.format === "vertical" ? "vertical 9:16, subject centered" : "square 1:1"}`,
  ].filter(Boolean).join("\n");
  return { system, user };
}

/** Итоговый промпт запасной модели: сцена от текстовой модели плюс формат кадра. */
export function buildFallbackImagePrompt(scene: string, format: ImageSceneInput["format"]) {
  const frame = format === "vertical" ? "vertical 9:16, subject centered" : "square 1:1";
  return `${scene.trim()} Editorial photograph, ${frame}.`;
}
