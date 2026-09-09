#!/usr/bin/env node
/**
 * Фоны бренда для лендинга: генерация тем же шлюзом, что рисует картинки постов,
 * плюс сжатие до размеров, которые не стыдно отдать в прод.
 *
 *   node scripts/backgrounds.mjs --optimize          пересобрать webp из raw
 *   node scripts/backgrounds.mjs --generate          дорисовать недостающие raw и сжать
 *   node scripts/backgrounds.mjs --generate --force  перерисовать всё заново
 *
 * Что где лежит:
 *   .backgrounds-raw/   PNG от модели, ~1,5 МБ штука. В гит не идёт (.gitignore).
 *   public/backgrounds/ webp в двух ширинах. Это и есть артефакт, который деплоится.
 *
 * Важно: модель каждый раз рисует новое, повторный --force даст другие картинки.
 * Источник правды — то, что лежит в public/backgrounds, а не промпт.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, ".backgrounds-raw");
const OUT = path.join(ROOT, "public/backgrounds");

/** Ширины под реальные экраны: 1920 хватает десктопу, 960 — телефону. */
const WIDTHS = [1920, 960];
const QUALITY = 72;

const NO_TEXT =
  "Pure abstract atmosphere: absolutely no text, no letters, no words, no logos, " +
  "no people, no faces, no objects, no buildings.";
const FRAME =
  "Wide cinematic background plate with generous empty space in the left half for overlaid typography.";

/** По три фона на тему: они переключаются вместе с выбранным форматом. */
const BACKGROUNDS = [
  { id: "dawn-1", prompt: `Abstract atmospheric dawn sky, soft peach and warm apricot blending into pale lilac and gentle rose, layered haze and soft light rays, very airy and calm, high-key, subtle film grain. ${NO_TEXT} ${FRAME}` },
  { id: "dawn-2", prompt: `Abstract atmospheric sky, cool pale lilac and soft periwinkle blue with faint warm pink at the horizon, layered haze, very airy and calm, high-key, soft film grain. ${NO_TEXT} ${FRAME}` },
  { id: "dawn-3", prompt: `Abstract atmospheric sky, warm amber and soft coral haze fading into cream, gentle light rays, very airy and calm, high-key, soft film grain. ${NO_TEXT} ${FRAME}` },
  { id: "night-1", prompt: `Abstract dark atmospheric scene, deep indigo and near-black night, a soft violet light source glowing in the upper right, faint teal rim light, volumetric haze, cinematic and premium, subtle film grain, mostly very dark. ${NO_TEXT} ${FRAME}` },
  { id: "night-2", prompt: `Abstract dark atmospheric scene, near-black with a deep teal and emerald glow rising from the lower left, faint violet rim light, volumetric haze, cinematic and premium, subtle film grain, mostly very dark. ${NO_TEXT} ${FRAME}` },
  { id: "night-3", prompt: `Abstract dark atmospheric scene, near-black with a warm amber and burnt orange glow in the upper centre fading into deep violet shadow, volumetric haze, cinematic and premium, subtle film grain, mostly very dark. ${NO_TEXT} ${FRAME}` },
];

function loadEnv() {
  const env = {};
  for (const file of [".env", ".env.local"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

/** Повторяет resolveImageGenerationsUrl из src/lib/openai.ts. */
function imageUrl(raw) {
  const cleaned = String(raw || "").trim().replace(/\/$/, "");
  if (!cleaned) return "";
  if (/\/images\/generations$/i.test(cleaned)) return cleaned;
  if (/\/images$/i.test(cleaned)) return `${cleaned}/generations`;
  if (/\/v1$/i.test(cleaned)) return `${cleaned}/images/generations`;
  return `${cleaned}/v1/images/generations`;
}

async function generate(item, env) {
  const key = env.OPENAI_IMAGE_API_KEY;
  const endpoint = imageUrl(env.OPENAI_IMAGE_BASE_URL || env.OPENAI_IMAGE_ENDPOINT);
  if (!key || !endpoint) {
    throw new Error("нет OPENAI_IMAGE_API_KEY или OPENAI_IMAGE_BASE_URL — фоны рисовать нечем");
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt: item.prompt,
      n: 1,
      size: "1792x1024",
    }),
  });
  if (!res.ok) throw new Error(`шлюз ответил ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const payload = await res.json();
  const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.images) ? payload.images : [];
  const first = rows[0] && typeof rows[0] === "object" ? rows[0] : {};
  const b64 = String(first.b64_json || first.b64 || first.base64 || "").trim();
  if (b64) return Buffer.from(b64, "base64");

  const url = String(first.url || payload.url || "").trim();
  if (!url) throw new Error("в ответе нет картинки");
  const file = await fetch(url);
  if (!file.ok) throw new Error(`картинка не скачалась: ${file.status}`);
  return Buffer.from(await file.arrayBuffer());
}

async function optimize(id) {
  const src = path.join(RAW, `${id}.png`);
  if (!fs.existsSync(src)) return null;
  const before = fs.statSync(src).size;
  const written = [];
  for (const width of WIDTHS) {
    const dest = path.join(OUT, width === WIDTHS[0] ? `${id}.webp` : `${id}-${width}.webp`);
    await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(dest);
    written.push({ dest, size: fs.statSync(dest).size });
  }
  return { before, written };
}

const args = new Set(process.argv.slice(2));
const wantGenerate = args.has("--generate");
const force = args.has("--force");

fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const env = wantGenerate ? loadEnv() : {};
let totalBefore = 0;
let totalAfter = 0;

for (const item of BACKGROUNDS) {
  const raw = path.join(RAW, `${item.id}.png`);
  if (wantGenerate && (force || !fs.existsSync(raw))) {
    process.stdout.write(`${item.id}: рисую... `);
    const buf = await generate(item, env);
    fs.writeFileSync(raw, buf);
    console.log(`${(buf.length / 1048576).toFixed(2)} МБ`);
  }
  const result = await optimize(item.id);
  if (!result) {
    console.log(`${item.id}: нет raw — пропускаю (запустите с --generate)`);
    continue;
  }
  totalBefore += result.before;
  const after = result.written.reduce((sum, w) => sum + w.size, 0);
  totalAfter += after;
  const sizes = result.written.map((w) => `${path.basename(w.dest)} ${(w.size / 1024).toFixed(0)} КБ`).join(", ");
  console.log(`${item.id}: ${(result.before / 1048576).toFixed(2)} МБ → ${sizes}`);
}

if (totalBefore) {
  console.log(
    `\nИтого: ${(totalBefore / 1048576).toFixed(1)} МБ → ${(totalAfter / 1048576).toFixed(2)} МБ ` +
      `(${Math.round((1 - totalAfter / totalBefore) * 100)}% меньше)`,
  );
}
