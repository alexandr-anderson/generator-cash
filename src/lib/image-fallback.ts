import { buildFallbackImagePrompt, buildImageSceneRequest, type ImageSceneInput } from "./ai-image-prompt";
import { notifyGenerationFailure } from "./alerts";
import { AiError, fallbackImagePng, imageFallbackConfigured, openaiJson } from "./openai";

/**
 * Состояние на один запрос генерации: раз основная модель уже не ответила,
 * остальные картинки того же поста сразу идут на запасную — иначе каждая ждала
 * бы все повторы основной заново.
 */
export type ImageFallbackState = { active: boolean };

/**
 * Картинка с запасным шлюзом (п. 50 в docs/work-plan.md).
 *
 * Основная модель пробуется как обычно. Если она упала и запасной шлюз настроен:
 * текстовая модель переписывает задачу в сцену по-английски, запасная модель её
 * рисует. Уход на запасную — деградация качества, поэтому он всегда шлёт алерт,
 * а не проходит молча.
 *
 * Если не справилась и запасная, наружу летит ошибка основной модели: причину
 * чинить нужно там, а запасная — только страховка.
 */
export async function createImageWithFallback(input: {
  primary: () => Promise<Buffer>;
  scene: ImageSceneInput;
  state: ImageFallbackState;
}): Promise<Buffer> {
  if (!input.state.active) {
    try {
      return await input.primary();
    } catch (error) {
      if (!imageFallbackConfigured()) throw error;
      console.error("[ai-image] основная модель картинок не ответила, уходим на запасную", error);
      notifyGenerationFailure("картинки, ушли на запасную модель", error);
      input.state.active = true;
      try {
        return await fallbackImage(input.scene);
      } catch (fallbackError) {
        console.error("[ai-image] запасная модель картинок тоже не ответила", fallbackError);
        throw error;
      }
    }
  }
  return fallbackImage(input.scene);
}

async function fallbackImage(scene: ImageSceneInput) {
  const { system, user } = buildImageSceneRequest(scene);
  const answer = await openaiJson<{ scene?: string }>({ system, user, maxTokens: 300 });
  const text = String(answer.scene || "").trim();
  if (!text) {
    throw new AiError("Не удалось подготовить описание картинки. Попробуйте ещё раз.", 502);
  }
  return fallbackImagePng({
    prompt: buildFallbackImagePrompt(text, scene.format),
    size: scene.format === "vertical" ? "1024x1792" : "1024x1024",
  });
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
