import type {
  CreativeBrief,
  CreativeDirection,
  CreativeFormat,
  StyleProfile,
} from "./types";

const formatLabels: Record<CreativeFormat, string> = {
  reel: "Обложка Reels",
  post: "Пост 4:5",
  carousel: "Карусель",
};

export function createDirections(
  profile: StyleProfile,
  brief: CreativeBrief,
): CreativeDirection[] {
  const topic = brief.topic.trim() || "Идея, которую сохранят";
  const colors = profile.colors.length >= 4
    ? profile.colors
    : ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"];

  return [
    {
      id: "editorial",
      name: "Editorial punch",
      rationale: "Сильный тезис и журнальная композиция",
      headline: topic,
      eyebrow: brief.mood || "Честно о главном",
      body: brief.cta || "Сохраните, чтобы вернуться",
      accent: colors[0],
      background: colors[2],
      foreground: colors[3],
      format: "reel",
      slides: buildSlides(topic, brief),
    },
    {
      id: "contrast",
      name: "Bold contrast",
      rationale: "Высокий контраст для быстрого скролла",
      headline: topic,
      eyebrow: brief.goal || "Новый выпуск",
      body: brief.cta || "Читайте в описании",
      accent: colors[1],
      background: colors[3],
      foreground: colors[2],
      format: "post",
      slides: buildSlides(topic, brief),
    },
    {
      id: "soft",
      name: "Soft story",
      rationale: "Спокойная подача и ощущение личного диалога",
      headline: topic,
      eyebrow: brief.audience || "Для тех, кто создаёт",
      body: brief.cta || "Листайте дальше",
      accent: colors[0],
      background: colors[2],
      foreground: colors[3],
      format: "carousel",
      slides: buildSlides(topic, brief),
    },
  ];
}

function buildSlides(topic: string, brief: CreativeBrief) {
  return [
    topic,
    "Почему старый подход больше не работает",
    "Сначала уберите всё лишнее",
    "Соберите одну ясную систему",
    brief.cta || "Сохраните и попробуйте сегодня",
  ];
}

export function duplicateForFormat(
  creative: CreativeDirection,
  format: CreativeFormat,
): CreativeDirection {
  return {
    ...creative,
    id: `${creative.id}-${format}`,
    format,
    name: formatLabels[format],
  };
}

export function getCanvasSize(format: CreativeFormat) {
  if (format === "reel") return { width: 1080, height: 1920 };
  return { width: 1080, height: 1350 };
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function wrapText(value: string, maxLength = 18) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    if (`${line} ${word}`.trim().length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

export function creativeToSvg(creative: CreativeDirection, slide = 0) {
  const { width, height } = getCanvasSize(creative.format);
  const headline = creative.format === "carousel"
    ? creative.slides[slide] ?? creative.headline
    : creative.headline;
  const lines = wrapText(headline);
  const startY = height * 0.39;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${creative.background}"/>
  <circle cx="${width * 0.88}" cy="${height * 0.12}" r="${width * 0.3}" fill="${creative.accent}" opacity="0.95"/>
  <rect x="72" y="72" width="238" height="54" rx="27" fill="${creative.accent}"/>
  <text x="191" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${creative.foreground}">${escapeXml(creative.eyebrow.toUpperCase())}</text>
  ${lines.map((line, index) => `<text x="72" y="${startY + index * 118}" font-family="Arial, sans-serif" font-size="102" font-weight="800" letter-spacing="-4" fill="${creative.foreground}">${escapeXml(line)}</text>`).join("")}
  <line x1="72" y1="${height - 220}" x2="${width - 72}" y2="${height - 220}" stroke="${creative.foreground}" stroke-width="3" opacity="0.3"/>
  <text x="72" y="${height - 140}" font-family="Arial, sans-serif" font-size="32" font-weight="600" fill="${creative.foreground}">${escapeXml(creative.body)}</text>
  <text x="${width - 72}" y="${height - 140}" text-anchor="end" font-family="Arial, sans-serif" font-size="26" fill="${creative.foreground}" opacity="0.6">POSTVMESTE · ${slide + 1}</text>
</svg>`;
}
