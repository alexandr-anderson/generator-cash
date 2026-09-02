import { traitValue } from "./brand-analysis";
import type {
  CreativeBrief,
  CreativeDirection,
  CreativeFormat,
  CreativeLayout,
  StyleProfile,
} from "./types";

const formatLabels: Record<CreativeFormat, string> = {
  reel: "Обложка Reels",
  post: "Пост 4:5",
  carousel: "Карусель",
};

function palette(profile: StyleProfile) {
  return profile.colors.length >= 4
    ? profile.colors
    : ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"];
}

function isAiry(profile: StyleProfile) {
  return /воздух|8 слов|коротк/i.test(traitValue(profile, "density"));
}

function isCentered(profile: StyleProfile) {
  return /центр|квадрат/i.test(traitValue(profile, "composition"));
}

function isVertical(profile: StyleProfile) {
  return /вертикал|9:16|мало полей/i.test(traitValue(profile, "composition"));
}

function layoutsFor(profile: StyleProfile): CreativeLayout[] {
  if (isCentered(profile)) return ["centered", "poster", "band"];
  if (isVertical(profile) || isAiry(profile)) return ["poster", "band", "centered"];
  return ["band", "poster", "centered"];
}

function voiceLead(profile: StyleProfile, brief: CreativeBrief) {
  const voice = traitValue(profile, "voice", brief.mood);
  return voice.split(",")[0]?.trim() || brief.mood || "В вашем стиле";
}

function buildSlides(profile: StyleProfile, brief: CreativeBrief) {
  const topic = brief.topic.trim() || "Идея, которую сохранят";
  const cta = brief.cta.trim() || "Сохраните и попробуйте сегодня";
  if (isAiry(profile)) {
    return [topic, "Одна мысль", "Один шаг", "Проверьте себя", cta];
  }
  return [
    topic,
    `${brief.audience || "Аудитория"}: ${brief.goal || "ясный следующий шаг"}`,
    traitValue(profile, "imagery", "Сначала уберите всё лишнее"),
    "Соберите одну ясную систему",
    cta,
  ];
}

export function createDirections(
  profile: StyleProfile,
  brief: CreativeBrief,
): CreativeDirection[] {
  const topic = brief.topic.trim() || "Идея, которую сохранят";
  const colors = palette(profile);
  const slides = buildSlides(profile, brief);
  const [firstLayout, secondLayout, thirdLayout] = layoutsFor(profile);
  const lead = voiceLead(profile, brief);
  const composition = traitValue(profile, "composition");
  const density = traitValue(profile, "density");

  return [
    {
      id: "editorial",
      name: "Editorial punch",
      rationale: `${profile.summary} Композиция: ${composition}.`,
      headline: topic,
      eyebrow: brief.mood || lead,
      body: brief.cta || "Сохраните, чтобы вернуться",
      accent: colors[0],
      background: colors[2],
      foreground: colors[3],
      format: "reel",
      layout: firstLayout,
      brandLabel: profile.name,
      slides,
    },
    {
      id: "contrast",
      name: "Bold contrast",
      rationale: `Высокий контраст на палитре референсов. ${density}.`,
      headline: topic,
      eyebrow: brief.goal || "Новый выпуск",
      body: brief.cta || "Читайте в описании",
      accent: colors[1],
      background: colors[3],
      foreground: colors[2],
      format: "post",
      layout: secondLayout,
      brandLabel: profile.name,
      slides,
    },
    {
      id: "soft",
      name: "Soft story",
      rationale: `${traitValue(profile, "voice")}. ${traitValue(profile, "imagery")}.`,
      headline: topic,
      eyebrow: brief.audience || lead,
      body: brief.cta || "Листайте дальше",
      accent: colors[0],
      background: colors[2],
      foreground: colors[3],
      format: "carousel",
      layout: thirdLayout,
      brandLabel: profile.name,
      slides,
    },
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

function wrapText(value: string, maxLength: number) {
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
  const airy = creative.layout === "poster" || creative.layout === "centered";
  const lines = wrapText(headline, airy ? 14 : 20);
  const credit = escapeXml(creative.brandLabel || "POSTVMESTE");
  const eyebrow = escapeXml(creative.eyebrow.toUpperCase());
  const body = escapeXml(creative.body);
  const text = lines
    .map((line) => escapeXml(line))
    .map((line, index) => {
      if (creative.layout === "centered") {
        return `<text x="${width / 2}" y="${height * 0.42 + index * 96}" text-anchor="middle" font-family="Arial, sans-serif" font-size="84" font-weight="800" letter-spacing="-3" fill="${creative.foreground}">${line}</text>`;
      }
      const startY = creative.layout === "band" ? height * 0.28 : height * 0.39;
      const size = creative.layout === "band" ? 88 : 102;
      return `<text x="72" y="${startY + index * (size + 16)}" font-family="Arial, sans-serif" font-size="${size}" font-weight="800" letter-spacing="-4" fill="${creative.foreground}">${line}</text>`;
    })
    .join("");

  if (creative.layout === "centered") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${creative.background}"/>
  <circle cx="${width / 2}" cy="${height * 0.22}" r="${width * 0.16}" fill="${creative.accent}"/>
  <text x="${width / 2}" y="${height * 0.235}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${creative.foreground}">${eyebrow}</text>
  ${text}
  <text x="${width / 2}" y="${height - 140}" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="600" fill="${creative.foreground}">${body}</text>
  <text x="${width / 2}" y="${height - 84}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="${creative.foreground}" opacity="0.55">${credit} · ${slide + 1}</text>
</svg>`;
  }

  if (creative.layout === "band") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${creative.background}"/>
  <rect width="${width}" height="${Math.round(height * 0.18)}" fill="${creative.accent}"/>
  <text x="72" y="${Math.round(height * 0.11)}" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${creative.foreground}">${eyebrow}</text>
  ${text}
  <line x1="72" y1="${height - 220}" x2="${width - 72}" y2="${height - 220}" stroke="${creative.foreground}" stroke-width="3" opacity="0.3"/>
  <text x="72" y="${height - 140}" font-family="Arial, sans-serif" font-size="32" font-weight="600" fill="${creative.foreground}">${body}</text>
  <text x="${width - 72}" y="${height - 140}" text-anchor="end" font-family="Arial, sans-serif" font-size="26" fill="${creative.foreground}" opacity="0.6">${credit} · ${slide + 1}</text>
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${creative.background}"/>
  <circle cx="${width * 0.88}" cy="${height * 0.12}" r="${width * 0.3}" fill="${creative.accent}" opacity="0.95"/>
  <rect x="72" y="72" width="238" height="54" rx="27" fill="${creative.accent}"/>
  <text x="191" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${creative.foreground}">${eyebrow}</text>
  ${text}
  <line x1="72" y1="${height - 220}" x2="${width - 72}" y2="${height - 220}" stroke="${creative.foreground}" stroke-width="3" opacity="0.3"/>
  <text x="72" y="${height - 140}" font-family="Arial, sans-serif" font-size="32" font-weight="600" fill="${creative.foreground}">${body}</text>
  <text x="${width - 72}" y="${height - 140}" text-anchor="end" font-family="Arial, sans-serif" font-size="26" fill="${creative.foreground}" opacity="0.6">${credit} · ${slide + 1}</text>
</svg>`;
}
