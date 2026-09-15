import { buildFallbackImagePrompt, buildImageSceneRequest, type ImageSceneInput } from "./ai-image-prompt";
import { errorText, notifyAlert } from "./alerts";
import { imageProviders, type ImageProvider, type ImageSize } from "./image-providers";
import { AiError, imageProviderPng, openaiJson } from "./openai";

/** Одна картинка поста: как её рисует основная модель и что нужно запасным. */
export type ImageJob = {
  primary: () => Promise<Buffer>;
  /** Обычный промпт — для запасных, которые понимают инструкции (`prompt: "original"`). */
  prompt: string;
  size: ImageSize;
  /** Исходные данные для сцены — для диффузионных запасных (`prompt: "scene"`). */
  scene: ImageSceneInput;
};

/**
 * Картинки поста с запасными шлюзами (п. 50 в docs/work-plan.md).
 *
 * 1. Основная модель рисует по очереди, как раньше. Упала на какой-то картинке —
 *    к ней больше не возвращаемся: иначе каждая следующая ждала бы её повторы.
 * 2. Оставшиеся картинки идут по запасным шлюзам из image-providers.ts по порядку.
 *    Последовательный шлюз, упав на картинке, дальше не используется; одновременный
 *    рисует все оставшиеся разом (codex.sale — 128–175 с на картинку, по очереди
 *    три не уложились бы в 400 с роута).
 * 3. Весь запасной путь укладывается в `budgetMs`.
 *
 * Алерт один и уходит в конце, с исходом: у алертов генерации общий интервал
 * 20 минут, второе сообщение он бы погасил. Если не выручил никто, наружу летит
 * ошибка основной модели — причину чинить там.
 */
export async function createImagesWithFallback(
  jobs: ImageJob[],
  options: { pauseMs?: number; budgetMs?: number } = {},
): Promise<Buffer[]> {
  const pauseMs = options.pauseMs ?? 800;
  const results: (Buffer | undefined)[] = new Array(jobs.length);
  let primaryError: unknown;
  let firstPending = jobs.length;

  for (let index = 0; index < jobs.length; index += 1) {
    if (index > 0 && pauseMs) await wait(pauseMs);
    try {
      results[index] = await jobs[index].primary();
    } catch (error) {
      primaryError = error;
      firstPending = index;
      break;
    }
  }
  if (firstPending === jobs.length) return results as Buffer[];

  const providers = imageProviders();
  if (!providers.length) throw primaryError;
  console.error("[ai-image] основная модель картинок не ответила, уходим на запасные", primaryError);

  const deadline = Date.now() + (options.budgetMs ?? 330_000);
  const helped = new Map<string, number>();
  const failures: string[] = [];
  let pending = jobs.map((_, index) => index).slice(firstPending);

  for (const provider of providers) {
    if (!pending.length) break;
    const left = deadline - Date.now();
    if (left < 15_000) {
      failures.push(`${provider.id}: пропущен — не осталось времени`);
      continue;
    }
    const timeoutMs = Math.min(provider.timeoutMs, left);

    if (provider.parallel) {
      const settled = await Promise.allSettled(pending.map((index) => drawWith(provider, jobs[index], timeoutMs)));
      const stillPending: number[] = [];
      settled.forEach((outcome, position) => {
        const index = pending[position];
        if (outcome.status === "fulfilled") {
          results[index] = outcome.value;
          helped.set(provider.id, (helped.get(provider.id) ?? 0) + 1);
        } else {
          stillPending.push(index);
          if (stillPending.length === 1) failures.push(`${provider.id}: ${describe(outcome.reason)}`);
        }
      });
      pending = stillPending;
    } else {
      const stillPending: number[] = [];
      let broken = false;
      for (const index of pending) {
        if (broken || deadline - Date.now() < 15_000) {
          stillPending.push(index);
          continue;
        }
        try {
          results[index] = await drawWith(provider, jobs[index], Math.min(provider.timeoutMs, deadline - Date.now()));
          helped.set(provider.id, (helped.get(provider.id) ?? 0) + 1);
        } catch (error) {
          failures.push(`${provider.id}: ${describe(error)}`);
          stillPending.push(index);
          broken = true;
        }
      }
      pending = stillPending;
    }
  }

  const summary = [...helped].map(([id, count]) => `${id} ×${count}`).join(", ");
  if (!pending.length) {
    void notifyAlert("generation", [
      `картинки: основная не ответила, выручили запасные — ${summary}`,
      `основная — ${describe(primaryError)}`,
      ...failures,
    ].join("\n"));
    return results as Buffer[];
  }

  console.error("[ai-image] запасные шлюзы картинок не выручили", failures.join(" | "));
  void notifyAlert("generation", [
    `картинки: основная не ответила, запасные не выручили (не нарисовано ${pending.length} из ${jobs.length})`,
    `основная — ${describe(primaryError)}`,
    ...failures,
  ].join("\n"));
  throw primaryError;
}

async function drawWith(provider: ImageProvider, job: ImageJob, timeoutMs: number) {
  let prompt = job.prompt;
  if (provider.prompt === "scene") {
    try {
      const { system, user } = buildImageSceneRequest(job.scene);
      const answer = await openaiJson<{ scene?: string }>({ system, user, maxTokens: 300 });
      const text = String(answer.scene || "").trim();
      if (!text) throw new AiError("Модель текста вернула пустую сцену.", 502);
      prompt = buildFallbackImagePrompt(text, job.scene.format);
    } catch (error) {
      throw new FallbackStepError("сцена (текстовая модель)", error);
    }
  }
  try {
    return await imageProviderPng(provider, { prompt, size: job.size, timeoutMs });
  } catch (error) {
    throw new FallbackStepError("картинка", error);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** На каком шаге запасного пути случился сбой — в алерте это главное. */
class FallbackStepError extends Error {
  constructor(readonly step: string, readonly original: unknown) {
    super(`${step}: ${errorText(original)}`);
    this.name = "FallbackStepError";
  }
}

/** Ошибка для алерта: сообщение, шаг и техническая причина (`AiError.detail`), если есть. */
function describe(error: unknown): string {
  if (error instanceof FallbackStepError) return `${error.step}: ${describe(error.original)}`;
  const detail = error instanceof AiError && error.detail ? ` [${error.detail}]` : "";
  return `${errorText(error)}${detail}`;
}

/**
 * Настоящий формат картинки по первым байтам. Шлюзы отдают разное: gpt-image —
 * PNG, Pollinations — JPEG, а файл раньше всегда сохранялся как `image/png`.
 */
export function detectImageMime(buffer: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}
