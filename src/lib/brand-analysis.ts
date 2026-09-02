import type { StyleProfile, StyleTrait } from "./types";

export type SourceDescriptor = {
  name: string;
  type: string;
  size: number;
};

export type PixelBuffer = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

export type ColorBucket = {
  hex: string;
  weight: number;
};

export type ReferenceSignals = SourceDescriptor & {
  width: number;
  height: number;
  meanLuma: number;
  meanSaturation: number;
  warmth: number;
  contrast: number;
  buckets: ColorBucket[];
};

const FALLBACK_PALETTE = ["#6b6560", "#c4b8a8", "#f4efe6", "#1a1816"];

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function luma(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function isSignals(source: SourceDescriptor | ReferenceSignals): source is ReferenceSignals {
  return "buckets" in source && Array.isArray((source as ReferenceSignals).buckets);
}

export function measureReference(
  source: SourceDescriptor,
  pixels?: PixelBuffer,
): ReferenceSignals {
  if (!pixels || pixels.width <= 0 || pixels.height <= 0 || pixels.data.length < 4) {
    return {
      ...source,
      width: 0,
      height: 0,
      meanLuma: 0.5,
      meanSaturation: 0.2,
      warmth: 0,
      contrast: 0.2,
      buckets: [],
    };
  }

  const counts = new Map<string, { r: number; g: number; b: number; n: number }>();
  let lumaSum = 0;
  let satSum = 0;
  let warmthSum = 0;
  let samples = 0;
  let minLuma = 1;
  let maxLuma = 0;
  const step = 24;

  for (let index = 0; index < pixels.data.length; index += 4) {
    const alpha = pixels.data[index + 3] ?? 255;
    if (alpha < 128) continue;
    const r = pixels.data[index] ?? 0;
    const g = pixels.data[index + 1] ?? 0;
    const b = pixels.data[index + 2] ?? 0;
    const qr = Math.min(255, Math.round(r / step) * step);
    const qg = Math.min(255, Math.round(g / step) * step);
    const qb = Math.min(255, Math.round(b / step) * step);
    const key = `${qr},${qg},${qb}`;
    const bucket = counts.get(key);
    if (bucket) bucket.n += 1;
    else counts.set(key, { r: qr, g: qg, b: qb, n: 1 });

    const sampleLuma = luma(r, g, b);
    lumaSum += sampleLuma;
    satSum += saturation(r, g, b);
    warmthSum += (r - b) / 255;
    minLuma = Math.min(minLuma, sampleLuma);
    maxLuma = Math.max(maxLuma, sampleLuma);
    samples += 1;
  }

  const buckets = [...counts.values()]
    .sort((left, right) => right.n - left.n)
    .slice(0, 12)
    .map((bucket) => ({
      hex: toHex(bucket.r, bucket.g, bucket.b),
      weight: bucket.n,
    }));

  return {
    ...source,
    width: pixels.width,
    height: pixels.height,
    meanLuma: samples ? lumaSum / samples : 0.5,
    meanSaturation: samples ? satSum / samples : 0,
    warmth: samples ? warmthSum / samples : 0,
    contrast: samples ? maxLuma - minLuma : 0,
    buckets,
  };
}

function hexLuma(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return luma(r, g, b);
}

function hexSaturation(hex: string) {
  const value = hex.replace("#", "");
  return saturation(
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  );
}

function paletteFromSignals(signals: ReferenceSignals[]): string[] {
  const pooled = signals
    .flatMap((signal) => signal.buckets)
    .sort((left, right) => right.weight - left.weight);

  const unique: string[] = [];
  for (const bucket of pooled) {
    if (!unique.some((hex) => colorsClose(hex, bucket.hex))) {
      unique.push(bucket.hex);
    }
    if (unique.length >= 8) break;
  }

  const chromatic = unique.filter((hex) => hexSaturation(hex) > 0.18);
  const neutrals = unique.filter((hex) => hexSaturation(hex) <= 0.18);
  const accent = chromatic[0] ?? unique[0];
  const secondary =
    chromatic.find((hex) => hex !== accent && !colorsClose(hex, accent)) ??
    unique.find((hex) => hex !== accent) ??
    accent;
  const paper =
    [...unique].sort((left, right) => hexLuma(right) - hexLuma(left))[0] ??
    "#f4efe6";
  const ink =
    [...unique].sort((left, right) => hexLuma(left) - hexLuma(right))[0] ??
    "#1a1816";

  const palette = [
    accent ?? FALLBACK_PALETTE[0],
    secondary ?? FALLBACK_PALETTE[1],
    hexLuma(paper) > 0.55 ? paper : FALLBACK_PALETTE[2],
    hexLuma(ink) < 0.45 ? ink : FALLBACK_PALETTE[3],
  ].map((hex) => hex.toLowerCase());

  if (hexLuma(palette[2]) - hexLuma(palette[3]) < 0.25) {
    palette[2] = "#f4efe6";
    palette[3] = "#1a1816";
  }

  if (neutrals.length === 0 && unique.length === 0) {
    return FALLBACK_PALETTE;
  }

  return palette;
}

function colorsClose(left: string, right: string) {
  const parse = (hex: string) => {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  };
  const [lr, lg, lb] = parse(left);
  const [rr, rg, rb] = parse(right);
  const distance = Math.hypot(lr - rr, lg - rg, lb - rb);
  return distance < 48;
}

function average(signals: ReferenceSignals[], key: keyof Pick<
  ReferenceSignals,
  "meanLuma" | "meanSaturation" | "warmth" | "contrast"
>) {
  if (signals.length === 0) return 0;
  return signals.reduce((sum, signal) => sum + signal[key], 0) / signals.length;
}

function typicalAspect(signals: ReferenceSignals[]) {
  const measured = signals.filter((signal) => signal.width > 0 && signal.height > 0);
  if (measured.length === 0) return 1;
  return (
    measured.reduce((sum, signal) => sum + signal.width / signal.height, 0) /
    measured.length
  );
}

function filenameHints(name: string) {
  const lower = name.toLowerCase();
  if (/(portrait|face|selfie|avatar)/.test(lower)) return "портрет";
  if (/(product|pack|bottle|item)/.test(lower)) return "предмет";
  if (/(logo|mark|icon)/.test(lower)) return "знак / логотип";
  if (/(cover|reel|story|post)/.test(lower)) return "обложка";
  return "";
}

function buildTraits(signals: ReferenceSignals[], sampled: boolean): StyleTrait[] {
  const warmth = average(signals, "warmth");
  const sat = average(signals, "meanSaturation");
  const contrast = average(signals, "contrast");
  const light = average(signals, "meanLuma");
  const aspect = typicalAspect(signals);
  const evidence = signals.slice(0, 3).map((signal) => signal.name);
  const sources = evidence.length ? evidence : ["референсы не прочитаны"];
  const bump = Math.min(18, signals.length * 3 + (sampled ? 8 : 0));

  let voice = "Сдержанный, спокойный, точный";
  if (warmth > 0.08 && sat > 0.28) voice = "Тёплый, живой, уверенный";
  else if (warmth < -0.06 && sat > 0.22) voice = "Прохладный, собранный, графичный";
  else if (contrast > 0.45) voice = "Прямой, контрастный, уверенный";
  else if (light > 0.7) voice = "Светлый, мягкий, открытый";

  let composition = "Смешанные кадры, один явный фокус";
  if (aspect < 0.72) composition = "Вертикальный кадр, крупный объект, мало полей";
  else if (aspect > 1.35) composition = "Горизонтальная сцена, воздух по краям";
  else if (Math.abs(aspect - 1) < 0.12) composition = "Квадратный фокус, центрированный объект";
  else if (aspect < 0.9) composition = "Портретный 4:5, крупный заголовок и один акцент";

  let density = "Сбалансированная плотность, читаемый тезис";
  if (contrast > 0.5 && light < 0.45) {
    density = "Короткий тезис, много воздуха, тёмный фон";
  } else if (light > 0.72 && contrast < 0.35) {
    density = "Светлая сцена, спокойная типографика, средний объём текста";
  } else if (sat > 0.4) {
    density = "До 8 слов на обложке, цвет несёт акцент";
  }

  const hints = signals.map((signal) => filenameHints(signal.name)).filter(Boolean);
  let imagery = "Предметные детали и спокойный свет";
  if (hints.includes("портрет")) imagery = "Портреты, крупный план, живой свет";
  else if (hints.includes("предмет") || hints.includes("знак / логотип")) {
    imagery = "Предметный акцент, чистый фон, узнаваемый объект";
  } else if (sat > 0.35 && warmth > 0.05) {
    imagery = "Насыщенные цвета, тёплый свет, фактурные детали";
  } else if (sat < 0.18) {
    imagery = "Приглушённые тона, мягкий свет, минимум декора";
  } else if (light < 0.35) {
    imagery = "Тёмные кадры, драматичный свет, мало деталей на фоне";
  }

  const asEvidence = (label: string) =>
    sources.map((source) => ({ label, source }));

  return [
    {
      id: "voice",
      label: "Голос",
      value: voice,
      confidence: Math.min(96, 62 + bump + Math.round(sat * 10)),
      evidence: asEvidence("Цвет и контраст"),
    },
    {
      id: "composition",
      label: "Композиция",
      value: composition,
      confidence: Math.min(94, 60 + bump + (aspect ? 8 : 0)),
      evidence: asEvidence("Пропорции кадра"),
    },
    {
      id: "density",
      label: "Плотность",
      value: density,
      confidence: Math.min(93, 61 + bump + Math.round(contrast * 12)),
      evidence: asEvidence("Свет и контраст"),
    },
    {
      id: "imagery",
      label: "Образы",
      value: imagery,
      confidence: Math.min(92, 58 + bump),
      evidence: asEvidence("Мотивы референсов"),
    },
  ];
}

export function traitValue(profile: StyleProfile, id: string, fallback = "") {
  return profile.traits.find((trait) => trait.id === id)?.value?.trim() || fallback;
}

export function profileConfidence(profile: StyleProfile) {
  if (profile.traits.length === 0) return 0;
  return Math.round(
    profile.traits.reduce((sum, trait) => sum + trait.confidence, 0) /
      profile.traits.length,
  );
}

export function profileToGenerationBrief(profile: StyleProfile) {
  return [
    profile.name,
    profile.summary,
    `palette ${profile.colors.join(" ")}`,
    traitValue(profile, "voice"),
    traitValue(profile, "composition"),
    traitValue(profile, "density"),
    traitValue(profile, "imagery"),
  ]
    .filter(Boolean)
    .join(". ");
}

export function analyzeBrandSources(
  sources: Array<SourceDescriptor | ReferenceSignals>,
  context: string,
): StyleProfile {
  const signals = sources.map((source) =>
    isSignals(source) ? source : measureReference(source),
  );
  const sampled = signals.some((signal) => signal.buckets.length > 0);
  const colors = sampled ? paletteFromSignals(signals) : FALLBACK_PALETTE;
  const traits = buildTraits(signals, sampled);
  const voice = traits[0]?.value ?? "";
  const imagery = traits[3]?.value ?? "";
  const name = context.trim() || "Мой авторский стиль";

  return {
    name,
    summary: sampled
      ? `${name}: ${voice.toLowerCase()} визуальный язык. ${imagery}. Палитра собрана только из загруженных референсов.`
      : `${name}: референсы ещё не прочитаны как изображение, поэтому палитра нейтральная. Добавьте файлы и повторите анализ.`,
    colors,
    approved: false,
    traits,
  };
}
