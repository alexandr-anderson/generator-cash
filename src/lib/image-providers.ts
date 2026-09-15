/**
 * Запасные шлюзы картинок по порядку — после основного (`OPENAI_IMAGE_*`).
 * Как ими пользоваться, решает `createImagesWithFallback` (image-fallback.ts).
 *
 * Как и у текстовых провайдеров (text-providers.ts): адреса и модели не секретны
 * и живут здесь, ключи — только в секретах, шлюз без ключа пропускается. Новую
 * переменную ключа добавить и в `ecosystem.config.cjs`, и в шаг деплоя.
 */

export type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";

export type ImageProvider = {
  id: string;
  endpoint: string;
  key: string;
  keyEnv: string;
  model: string;
  /**
   * `original` — наш обычный промпт (модель понимает инструкции и запреты, как gpt-image);
   * `scene` — сцена по-английски от текстовой модели: диффузионные модели читают
   * промпт буквально и печатают тему или рисуют «запрещённые» плакаты (п. 50).
   */
  prompt: "original" | "scene";
  /** Рисовать оставшиеся картинки поста одновременно, а не по очереди. */
  parallel: boolean;
  attempts: number;
  timeoutMs: number;
};

type ProviderConfig = Omit<ImageProvider, "key">;

const FALLBACK_IMAGE_PROVIDERS: ProviderConfig[] = [
  {
    // 3,8–13 с на картинку, 0,004 Pollen, отдаёт JPEG. Проверен на проде 2026-09-15.
    id: "pollinations",
    endpoint: "https://gen.pollinations.ai/v1/images/generations",
    keyEnv: "POLLINATIONS_API_KEY",
    model: "tongyi-mai/z-image-turbo",
    prompt: "scene",
    parallel: false,
    attempts: 2,
    timeoutMs: 60_000,
  },
  {
    // Настоящая gpt-image-2 за токены владельца: качество как у основной, но
    // 2026-09-15 рисовала 128–175 с на картинку (раньше 35–50 с) — у шлюза проблемы
    // с подключением к OpenAI. По очереди три картинки не уложились бы в 400 с
    // роута, поэтому одновременно и последним рубежом.
    id: "codex-sale",
    endpoint: "https://codex.sale/v1/images/generations",
    keyEnv: "CODEX_SALE_API_KEY",
    model: "gpt-image-2",
    prompt: "original",
    parallel: true,
    attempts: 1,
    timeoutMs: 240_000,
  },
];

export function imageProviders(env: Record<string, string | undefined> = process.env): ImageProvider[] {
  return FALLBACK_IMAGE_PROVIDERS
    .map((provider) => ({ ...provider, key: env[provider.keyEnv]?.trim() || "" }))
    .filter((provider) => provider.key);
}

/** Для стартового лога: `pollinations,codex-sale` — какие запасные шлюзы включены. */
export function imageProvidersLabel() {
  return imageProviders().map((provider) => provider.id).join(",");
}
