import type { StyleProfile } from "./types";

export type SourceDescriptor = {
  name: string;
  type: string;
  size: number;
};

const palettes = [
  ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"],
  ["#7c5cff", "#b8ff6a", "#f7f5ff", "#17151f"],
  ["#126b5b", "#ef8354", "#f4efe6", "#17201e"],
];

function hashSources(sources: SourceDescriptor[]) {
  return sources.reduce(
    (sum, source) =>
      sum + [...source.name].reduce((nameSum, char) => nameSum + char.charCodeAt(0), 0),
    0,
  );
}

export function analyzeBrandSources(
  sources: SourceDescriptor[],
  context: string,
): StyleProfile {
  const sourceCount = sources.length;
  const palette = palettes[hashSources(sources) % palettes.length];
  const sourceNames = sources.slice(0, 3).map((source) => source.name);
  const evidence = sourceNames.length
    ? sourceNames
    : ["Добавьте референсы, чтобы повысить точность"];

  return {
    name: context.trim() || "Мой авторский стиль",
    summary:
      "Тёплый экспертный визуальный язык: смелые заголовки, живой ритм и много воздуха. Сложное объясняется просто, без ощущения шаблонного контента.",
    colors: palette,
    approved: false,
    traits: [
      {
        id: "voice",
        label: "Голос",
        value: "Прямой, дружелюбный, уверенный",
        confidence: Math.min(96, 72 + sourceCount * 2),
        evidence: evidence.map((source) => ({ label: "Текст и подписи", source })),
      },
      {
        id: "composition",
        label: "Композиция",
        value: "Крупный заголовок, асимметрия, один фокус",
        confidence: Math.min(94, 68 + sourceCount * 2),
        evidence: evidence.map((source) => ({ label: "Визуальный паттерн", source })),
      },
      {
        id: "density",
        label: "Плотность",
        value: "До 8 слов на обложке, много воздуха",
        confidence: Math.min(92, 70 + sourceCount),
        evidence: evidence.map((source) => ({ label: "OCR-анализ", source })),
      },
      {
        id: "imagery",
        label: "Образы",
        value: "Портреты, предметные детали, мягкий свет",
        confidence: Math.min(90, 64 + sourceCount * 2),
        evidence: evidence.map((source) => ({ label: "Мотивы", source })),
      },
    ],
  };
}
