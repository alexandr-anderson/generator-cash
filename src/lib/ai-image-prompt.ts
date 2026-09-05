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
