/**
 * Разовый замер времени генерации моделью для трёх сценариев создания
 * (карусель / пост / обложка reels), отдельно текстовая и картиночная модель.
 *
 * Бьёт напрямую в те же шлюзы, что и прод (`OPENAI_*` / `OPENAI_IMAGE_*` из
 * .env), минуя HTTP-роуты, БД и квоты — чтобы не поднимать MySQL локально.
 * Использует ровно те же функции из src/lib/ai-copy.ts и src/lib/openai.ts,
 * с той же последовательностью вызовов, что и /api/ai/compose и /api/ai/expand
 * (см. composePost/composeReel в src/app/api/ai/compose/route.ts).
 *
 * Запуск: npx tsx scripts/timing-probe.ts
 */
import "dotenv/config";
import {
  composeVariantPreviews,
  expandCarouselSlides,
  composePostCopy,
  composeReelCopy,
} from "../src/lib/ai-copy";
import { openaiImagePng } from "../src/lib/openai";

const TOPIC = "Почему клиенты не возвращаются после первой покупки";
const NICHE = "маркетинг для小 бизнеса".replace("小", ""); // на всякий случай без кириллицы-ловушек
const TONE = "спокойный и уверенный";

type TimedResult<T> = { label: string; ms: number; ok: boolean; error?: string; value?: T };

async function timed<T>(label: string, fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = Date.now();
  process.stdout.write(`  → ${label} … `);
  try {
    const value = await fn();
    const ms = Date.now() - start;
    console.log(`ok, ${(ms / 1000).toFixed(1)}с`);
    return { label, ms, ok: true, value };
  } catch (error) {
    const ms = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`ОШИБКА (${(ms / 1000).toFixed(1)}с): ${message}`);
    return { label, ms, ok: false, error: message };
  }
}

function summarize(results: TimedResult<unknown>[]) {
  for (const r of results) {
    console.log(`    ${r.ok ? "OK " : "ERR"}  ${r.label.padEnd(28)} ${(r.ms / 1000).toFixed(1)}с`);
  }
}

async function scenarioCarousel() {
  console.log("\n=== Карусель (только текстовая модель) ===");
  const wallStart = Date.now();
  const results: TimedResult<unknown>[] = [];

  const hooks = await timed("compose:carousel-hooks", () =>
    composeVariantPreviews({
      format: "carousel",
      topic: TOPIC,
      text: "",
      niche: NICHE,
      tone: TONE,
    }),
  );
  results.push(hooks);

  const firstSlide = hooks.ok
    ? (hooks.value as { scenarios: { name: string; slides: string[] }[] }).scenarios[0]?.slides[0] || TOPIC
    : TOPIC;
  const scenarioName = hooks.ok
    ? (hooks.value as { scenarios: { name: string }[] }).scenarios[0]?.name
    : undefined;

  const expand = await timed("expand:carousel", () =>
    expandCarouselSlides({
      topic: TOPIC,
      text: "",
      niche: NICHE,
      tone: TONE,
      scenario: scenarioName || "pain",
      firstSlide,
    }),
  );
  results.push(expand);

  const wallMs = Date.now() - wallStart;
  console.log(`  Итого (последовательно, как в реальном флоу): ${(wallMs / 1000).toFixed(1)}с`);
  summarize(results);
  return { scenario: "carousel", wallMs, textMs: results.reduce((s, r) => s + r.ms, 0), imageMs: 0, results };
}

async function scenarioPost() {
  console.log("\n=== Пост (текст + картинки параллельно, без референсов) ===");
  const wallStart = Date.now();

  const textPromise = timed("compose:post-hashtags (текст)", () =>
    composePostCopy({
      topic: TOPIC,
      text: "Короткий тест поста для замера времени генерации.",
      niche: NICHE,
    }),
  );

  const imagesPromise = (async () => {
    const shots: TimedResult<unknown>[] = [];
    for (let i = 0; i < 3; i += 1) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 800));
      shots.push(
        await timed(`image ${i + 1}/3 (post, 1024x1024)`, () =>
          openaiImagePng({ prompt: `Тестовый промпт поста #${i + 1}: ${TOPIC}` }),
        ),
      );
    }
    return shots;
  })();

  const [textResult, imageResults] = await Promise.all([textPromise, imagesPromise]);
  const wallMs = Date.now() - wallStart;

  console.log(`  Итого (текст и картинки параллельно): ${(wallMs / 1000).toFixed(1)}с`);
  summarize([textResult, ...imageResults]);
  return {
    scenario: "post",
    wallMs,
    textMs: textResult.ms,
    imageMs: imageResults.reduce((s, r) => s + r.ms, 0),
    results: [textResult, ...imageResults],
  };
}

async function scenarioReel() {
  console.log("\n=== Обложка Reels (текст + картинки параллельно, без референсов, без своего хука) ===");
  const wallStart = Date.now();

  const textPromise = timed("hooks+caption (текст, последовательно)", () =>
    composeReelCopy({
      topic: TOPIC,
      niche: NICHE,
      tone: TONE,
    }),
  );

  const imagesPromise = (async () => {
    const shots: TimedResult<unknown>[] = [];
    for (let i = 0; i < 3; i += 1) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 800));
      shots.push(
        await timed(`image ${i + 1}/3 (reel, 1024x1792)`, () =>
          openaiImagePng({ prompt: `Тестовый промпт обложки #${i + 1}: ${TOPIC}`, size: "1024x1792" }),
        ),
      );
    }
    return shots;
  })();

  const [textResult, imageResults] = await Promise.all([textPromise, imagesPromise]);
  const wallMs = Date.now() - wallStart;

  console.log(`  Итого (текст и картинки параллельно): ${(wallMs / 1000).toFixed(1)}с`);
  summarize([textResult, ...imageResults]);
  return {
    scenario: "reel",
    wallMs,
    textMs: textResult.ms,
    imageMs: imageResults.reduce((s, r) => s + r.ms, 0),
    results: [textResult, ...imageResults],
  };
}

async function main() {
  console.log("Модель текста:", process.env.OPENAI_MODEL, "@", process.env.OPENAI_BASE_URL);
  console.log("Модель картинок:", process.env.OPENAI_IMAGE_MODEL, "@", process.env.OPENAI_IMAGE_BASE_URL);

  const carousel = await scenarioCarousel();
  const post = await scenarioPost();
  const reel = await scenarioReel();

  console.log("\n=== Итог ===");
  for (const s of [carousel, post, reel]) {
    console.log(
      `${s.scenario.padEnd(10)} wall=${(s.wallMs / 1000).toFixed(1)}с  текст=${(s.textMs / 1000).toFixed(1)}с  картинки=${(s.imageMs / 1000).toFixed(1)}с`,
    );
  }
}

main().catch((error) => {
  console.error("Провал скрипта:", error);
  process.exit(1);
});
