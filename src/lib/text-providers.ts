/**
 * Провайдеры текстовых моделей по порядку: сначала основной из секретов
 * (`OPENAI_*`), дальше запасные отсюда. Перебор идёт по моделям внутри
 * провайдера, потом к следующему провайдеру (см. `openaiJson` в openai.ts).
 *
 * Зачем цепочка, а не список моделей одного шлюза: 2026-09-14 у ключа AiHubMix
 * кончилась дневная бесплатная квота сразу на всех моделях, которыми мы
 * пользуемся, — и текст, и картинки, и шаг сцены запасных картинок встали разом.
 * Отдельный ключ у отдельного провайдера от этого страхует.
 *
 * Правила списка:
 * - модели — только проверенные замером (русский, строгий JSON), не из каталога
 *   провайдера на лету: присутствие в каталоге не значит, что модель отвечает (п. 34);
 * - адреса и имена моделей не секретны и живут здесь, ключи — только в секретах;
 * - провайдер без ключа просто пропускается;
 * - новую переменную ключа добавить и в `ecosystem.config.cjs`, и в шаг деплоя.
 */

export type TextProvider = {
  id: string;
  baseUrl: string;
  key: string;
  /** Имя переменной ключа — чтобы ошибка называла, что проверить. */
  keyEnv: string;
  models: string[];
  /** Особые параметры провайдера, добавляются в каждое тело запроса. */
  extraBody?: Record<string, unknown>;
};

type FallbackProvider = Omit<TextProvider, "key">;

const FALLBACK_PROVIDERS: FallbackProvider[] = [
  {
    // Бесплатные flash-модели. На промпте карусели glm-4.5-flash по умолчанию
    // сначала «думает»: 21,4 с и 557 токенов; с thinking=disabled — 5,3 с и 109.
    // glm-4.7-flash бывает перегружена (1305) и отвечает до минуты.
    id: "zai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    keyEnv: "ZAI_API_KEY",
    models: ["glm-4.5-flash", "glm-4.7-flash"],
    extraBody: { thinking: { type: "disabled" } },
  },
  {
    // Последний рубеж: платится Pollen из того же бюджета, что запасные картинки
    // (~0,0003 Pollen за ответ). Модели без paid_only, проверены 2026-09-15 на
    // промпте карусели: deepseek 2,9 с, glm-5.3-flash 15,8 с (думает, 1499 токенов),
    // muse-glimmer 9 с на коротком промпте. nemotron-3.5-lightning отвергнута —
    // печатает рассуждения по-английски вместо JSON.
    id: "pollinations",
    baseUrl: "https://gen.pollinations.ai/v1",
    keyEnv: "POLLINATIONS_API_KEY",
    models: ["deepseek/deepseek-v4-flash-vision-exp", "z-ai/glm-5.3-flash", "meta/muse-glimmer-30b"],
  },
];

function splitModels(raw: string | undefined) {
  return (raw || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function textProviders(env: Record<string, string | undefined> = process.env): TextProvider[] {
  const primary: TextProvider = {
    id: "primary",
    baseUrl: (env.OPENAI_BASE_URL || "https://codex-free.com/v1").replace(/\/$/, ""),
    key: env.OPENAI_API_KEY?.trim() || "",
    keyEnv: "OPENAI_API_KEY",
    models: splitModels(env.OPENAI_MODEL),
  };
  const fallbacks = FALLBACK_PROVIDERS.map((provider) => ({
    ...provider,
    key: env[provider.keyEnv]?.trim() || "",
  }));
  return [primary, ...fallbacks].filter((provider) => provider.key && provider.models.length);
}

/** Для стартового лога: `primary:4,zai:2` — какие провайдеры реально включены. */
export function textProvidersLabel() {
  return textProviders().map((provider) => `${provider.id}:${provider.models.length}`).join(",");
}

/**
 * Память о сбоях в процессе: модель, упёршуюся в квоту, незачем дёргать на
 * каждом запросе — это лишние попытки и время до ответа. Счётчики в памяти
 * одного процесса, как и лимиты (PM2 fork, один инстанс).
 */
const unavailableUntil = new Map<string, number>();

function healthKey(providerId: string, model?: string) {
  return model ? `${providerId}/${model}` : providerId;
}

export function markUnavailable(providerId: string, model: string | undefined, ms: number, now = Date.now()) {
  unavailableUntil.set(healthKey(providerId, model), now + ms);
}

export function isUnavailable(providerId: string, model: string, now = Date.now()) {
  const until = Math.max(
    unavailableUntil.get(healthKey(providerId)) ?? 0,
    unavailableUntil.get(healthKey(providerId, model)) ?? 0,
  );
  return until > now;
}

export function resetTextProviderHealth() {
  unavailableUntil.clear();
}

/**
 * Порядок попыток: здоровые пары «провайдер/модель» по приоритету, за ними —
 * те, что сейчас в паузе. Паузу не соблюдаем жёстко: если легло всё, лучше
 * попробовать ещё раз, чем сразу отказать.
 */
export function attemptOrder(providers: TextProvider[], now = Date.now()) {
  const pairs = providers.flatMap((provider) => provider.models.map((model) => ({ provider, model })));
  return [
    ...pairs.filter(({ provider, model }) => !isUnavailable(provider.id, model, now)),
    ...pairs.filter(({ provider, model }) => isUnavailable(provider.id, model, now)),
  ];
}
