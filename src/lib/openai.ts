export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function openaiConfigured() {
  // Модель входит в «настроено» наравне с ключом: без неё генерация не работает,
  // и health должен показывать это сразу, а не после первой попытки.
  return Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim());
}

export function openaiBaseUrl() {
  return (process.env.OPENAI_BASE_URL || "https://codex-free.com/v1").replace(/\/$/, "");
}

/**
 * Имя текстовой модели. Пусто — значит не настроено, и это ошибка, а не повод
 * что-то подставить.
 *
 * Раньше здесь стоял запасной `gpt-5.5`, и такие же запасные лежали в
 * `ecosystem.config.cjs` и в шаге деплоя. Из-за этого смена модели на
 * `chatgpt-5.6` дважды «прошла успешно», а прод двое суток работал на старой
 * модели: настройки не было, но никто не жаловался — подставлялось молча, да ещё
 * и записывалось в серверный `.env`. Нашлось только по логам шлюза.
 * Молчаливый дефолт скрывает отсутствие настройки — поэтому его больше нет.
 */
export function openaiModel() {
  const model = process.env.OPENAI_MODEL?.trim();
  if (!model) {
    throw new AiError("Модель текста не настроена. Задайте OPENAI_MODEL.", 503);
  }
  return model;
}

/** Для диагностики: имя модели или пустая строка, без исключения. */
export function openaiModelOrEmpty() {
  return process.env.OPENAI_MODEL?.trim() || "";
}

/**
 * Имя модели картинок. Как и у текстовой: пусто — это ошибка, а не повод
 * подставить своё. Запасное `gpt-image-2` лежало ровно в тех же трёх местах и
 * скрывало бы отсутствие настройки точно так же.
 */
export function openaiImageModel() {
  const model = process.env.OPENAI_IMAGE_MODEL?.trim();
  if (!model) {
    throw new AiError("Модель картинок не настроена. Задайте OPENAI_IMAGE_MODEL.", 503);
  }
  return model;
}

/** Для диагностики: имя модели картинок или пустая строка, без исключения. */
export function openaiImageModelOrEmpty() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "";
}

export function openaiImageKey() {
  return process.env.OPENAI_IMAGE_API_KEY?.trim() || "";
}

export function openaiImageConfigured() {
  // Модель входит в «настроено» наравне с ключом и адресом.
  return Boolean(openaiImageKey() && openaiImageGenerationsUrl() && openaiImageModelOrEmpty());
}

export function resolveImageGenerationsUrl(raw: string) {
  const cleaned = raw.trim().replace(/\/$/, "");
  if (!cleaned) return "";
  if (/\/images\/generations$/i.test(cleaned)) return cleaned;
  if (/\/images$/i.test(cleaned)) return `${cleaned}/generations`;
  if (/\/v1$/i.test(cleaned)) return `${cleaned}/images/generations`;
  return `${cleaned}/v1/images/generations`;
}

export function openaiImageGenerationsUrl() {
  return resolveImageGenerationsUrl(
    process.env.OPENAI_IMAGE_BASE_URL || process.env.OPENAI_IMAGE_ENDPOINT || "",
  );
}

export function openaiImageHost() {
  try {
    return openaiImageGenerationsUrl() ? new URL(openaiImageGenerationsUrl()).host : "";
  } catch {
    return "invalid";
  }
}

export function openaiHost() {
  try {
    return new URL(openaiBaseUrl()).host;
  } catch {
    return "invalid";
  }
}

type ChatJsonArgs = {
  system: string;
  user: string;
  timeoutMs?: number;
  jsonMode?: boolean;
  maxTokens?: number;
  /**
   * Зовётся по мере того, как модель печатает — кусками текста, как они пришли.
   * Нужен, чтобы дотянуть живой прогресс до браузера; на результат не влияет.
   */
  onDelta?: (chunk: string) => void;
};

export async function openaiJson<T>(args: ChatJsonArgs): Promise<T> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new AiError("Генерация текста ещё не настроена. Задайте OPENAI_API_KEY.", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 180_000);
  const jsonMode = args.jsonMode !== false;
  const messages = [
    { role: "system" as const, content: args.system },
    { role: "user" as const, content: args.user },
  ];

  try {
    const response = await postChatTryingVariants(
      chatBodiesForRequest(messages, jsonMode, args.maxTokens),
      key,
      controller.signal,
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("[ai] error", openaiHost(), response.status, body.slice(0, 400));
      if (response.status === 401 || response.status === 403) {
        throw new AiError("Ключ модели отклонён. Проверьте OPENAI_API_KEY.", 502);
      }
      if (response.status === 429) {
        throw new AiError("Модель временно недоступна. Попробуйте ещё раз через минуту.", 429);
      }
      throw new AiError("Не удалось сгенерировать текст. Попробуйте ещё раз.", 502);
    }

    const content = await readStreamedContent(response, args.onDelta);
    if (!content) {
      throw new AiError("Пустой ответ модели. Попробуйте ещё раз.", 502);
    }

    try {
      return JSON.parse(stripFence(content)) as T;
    } catch {
      throw new AiError("Модель вернула ответ в неожиданном формате. Попробуйте ещё раз.", 502);
    }
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiError("Модель не ответила вовремя. Попробуйте ещё раз.", 504);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiError("Модель не ответила вовремя. Попробуйте ещё раз.", 504);
    }
    console.error("[ai] request failed", openaiHost(), error);
    throw new AiError("Не удалось сгенерировать текст. Попробуйте ещё раз.", 502);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Варианты тела запроса в порядке предпочтения.
 *
 * Раньше форму параметров выбирала эвристика по имени модели (`/^gpt-5/`), и это
 * ломало обещание «смена провайдера — это замена секретов»: назови модель иначе,
 * и ей молча уходил не тот набор. Наша собственная `chatgpt-5.6` под тот шаблон
 * уже не подходила и работала лишь потому, что шлюз оказался терпимым.
 *
 * Теперь имя модели ни на что не влияет: пробуем современную форму, а если шлюз
 * ответил `400`, переходим к следующему варианту. Так же устроены запасные формы
 * для картинок и отключение JSON-режима.
 */
export function chatBodies(
  model: string,
  messages: { role: string; content: unknown }[],
  jsonMode: boolean,
  maxTokens?: number,
): Record<string, unknown>[] {
  const limit = maxTokens ?? 1600;
  const base: Record<string, unknown> = { model, messages, stream: true };
  const json = { response_format: { type: "json_object" } };
  // Современная форма: без temperature, лимит в max_completion_tokens.
  const modern = { max_completion_tokens: limit };
  // Прежняя форма, её ждут модели постарше и часть шлюзов.
  const legacy = { temperature: 0.7, max_tokens: limit };

  const shapes = [modern, legacy];
  const variants = jsonMode
    ? [
        ...shapes.map((shape) => ({ ...base, ...shape, ...json })),
        // Если дело было не в параметрах, а в самом JSON-режиме.
        ...shapes.map((shape) => ({ ...base, ...shape })),
      ]
    : shapes.map((shape) => ({ ...base, ...shape }));

  return variants;
}

/**
 * Стрим включён во всех вариантах, даже когда дельты никому не нужны. Дело не в
 * скорости ответа целиком — она та же, — а в том, что шлюз молчит около двух
 * минут до первого байта (замер 2026-09-10: 119 с на запрос в 10 токенов). Такую
 * паузу соединение не переживает: рвётся и у нас, и по дороге к браузеру. Со
 * стримом первый байт приходит за ~3 с и связь больше не простаивает.
 *
 * ВАЖНО: раз стрим безусловный, **любой** вызывающий обязан читать ответ через
 * readStreamedContent, а не response.json(). Когда это правило завели, про
 * openaiVisualBrief и openaiCarouselRecipe забыли — они продолжали звать
 * response.json(), падали на потоке и молча возвращали пустоту: референсы
 * перестали влиять и на картинки, и на рецепт карусели, при этом нигде ни одной
 * ошибки. Нашлось только по логам шлюза.
 */
function chatBodiesForRequest(
  messages: { role: string; content: unknown }[],
  jsonMode: boolean,
  maxTokens?: number,
) {
  return chatBodies(openaiModel(), messages, jsonMode, maxTokens);
}

/**
 * Шлёт первый вариант, а пока шлюз отвечает `400` — переходит к следующему.
 *
 * Через него обязаны идти **все** вызовы чата, включая зрение: когда-то
 * openaiVisualBrief и openaiCarouselRecipe остались в стороне от общего правила
 * про стрим и молча перестали работать. Здесь тот же риск, поэтому перебор живёт
 * в одном месте, а не переписывается в каждой функции.
 *
 * Каждый `400` возвращается быстро — до генерации дело не доходит, так что
 * перебор почти ничего не стоит по времени.
 */
async function postChatTryingVariants(
  variants: Record<string, unknown>[],
  key: string,
  signal: AbortSignal,
): Promise<Response> {
  let response = await postChat(variants[0], key, signal);

  for (let next = 1; next < variants.length && response.status === 400; next += 1) {
    const rejected = await response.text();
    console.error(
      "[ai] 400, пробуем другую форму запроса",
      openaiHost(),
      `вариант ${next + 1} из ${variants.length}`,
      rejected.slice(0, 300),
    );
    response = await postChat(variants[next], key, signal);
  }

  return response;
}

function pickMessageContent(payload: {
  choices?: { message?: { content?: unknown } }[];
  output_text?: string;
}) {
  const raw = payload.choices?.[0]?.message?.content;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw)) {
    const joined = raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text || "");
        }
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  return "";
}

/**
 * Собирает текст ответа из SSE-потока `chat/completions`.
 *
 * Поток приходит строками `data: {...}` и закрывается `data: [DONE]`. Куски сети
 * режутся где угодно, в том числе посередине строки, поэтому держим буфер и
 * разбираем только завершённые строки.
 *
 * Некоторые шлюзы на тот же адрес отвечают обычным JSON, игнорируя `stream: true`,
 * — такой ответ тоже понимаем, чтобы не зависеть от поведения конкретного шлюза.
 */
export async function readStreamedContent(
  response: Response,
  onDelta?: (chunk: string) => void,
): Promise<string> {
  const type = response.headers.get("content-type") || "";
  if (!response.body || !/event-stream/i.test(type)) {
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      output_text?: string;
    };
    const whole = pickMessageContent(payload);
    if (whole) onDelta?.(whole);
    return whole;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut = buffer.indexOf("\n");
    while (cut !== -1) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      cut = buffer.indexOf("\n");

      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: unknown } }[];
        };
        const piece = chunk.choices?.[0]?.delta?.content;
        if (typeof piece === "string" && piece) {
          content += piece;
          onDelta?.(piece);
        }
      } catch {
        // Одна битая строка потока не повод терять весь ответ — пропускаем её.
      }
    }
  }

  return content.trim();
}

async function postChat(body: unknown, key: string, signal: AbortSignal) {
  return fetch(`${openaiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    signal,
    body: JSON.stringify(body),
  });
}

function stripFence(content: string) {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function openaiImagePng(args: {
  prompt: string;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  timeoutMs?: number;
}): Promise<Buffer> {
  const key = openaiImageKey();
  const endpoint = openaiImageGenerationsUrl();
  if (!key || !endpoint) {
    throw new AiError("Генерация картинок ещё не настроена. Задайте OPENAI_IMAGE_API_KEY и OPENAI_IMAGE_BASE_URL.", 503);
  }

  const model = openaiImageModel();
  const bodies = imageRequestBodies(model, args.prompt, args.size || "1024x1024");
  const attempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 90_000);
    try {
      let response = await postImage(bodies[0], key, endpoint, controller.signal);
      if (response.status === 400 && bodies[1]) {
        const firstBody = await response.text();
        console.error("[ai-image] 400, retry alternate body", openaiImageHost(), firstBody.slice(0, 400));
        response = await postImage(bodies[1], key, endpoint, controller.signal);
      }

      if (!response.ok) {
        const body = await response.text();
        console.error("[ai-image] error", openaiImageHost(), model, response.status, `attempt=${attempt}`, body.slice(0, 400));
        if (response.status === 401) {
          throw new AiError("Ключ картинок отклонён. Проверьте OPENAI_IMAGE_API_KEY.", 502);
        }
        if (response.status === 403 || /model-not-allowed|not allowed to use the requested model/i.test(body)) {
          throw new AiError("Этот ключ не умеет выбранную модель картинок. Проверьте OPENAI_IMAGE_MODEL.", 502);
        }
        if (response.status === 404) {
          throw new AiError("Endpoint картинок не найден. Проверьте OPENAI_IMAGE_BASE_URL.", 502);
        }
        if (response.status === 429) {
          throw new AiError("Модель временно недоступна. Попробуйте ещё раз через минуту.", 429);
        }
        const retryable = response.status >= 500 || /stream_incomplete|оборвался/i.test(body);
        if (retryable && attempt < attempts) {
          await wait(1200 * attempt);
          continue;
        }
        throw new AiError(
          retryable
            ? "Шлюз картинок оборвал ответ. Нажмите «Создать» ещё раз."
            : "Не удалось нарисовать картинку. Попробуйте ещё раз.",
          502,
        );
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const png = await imagePayloadToPng(payload);
      if (!png) {
        throw new AiError("Модель вернула картинку в неожиданном формате. Попробуйте ещё раз.", 502);
      }
      return png;
    } catch (error) {
      if (error instanceof AiError) throw error;
      lastError = error;
      const aborted =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");
      if (aborted && attempt < attempts) {
        await wait(1200 * attempt);
        continue;
      }
      if (aborted) {
        throw new AiError("Картинка не успела нарисоваться. Попробуйте ещё раз.", 504);
      }
      console.error("[ai-image] request failed", openaiImageHost(), error);
      throw new AiError("Не удалось нарисовать картинку. Попробуйте ещё раз.", 502);
    } finally {
      clearTimeout(timer);
    }
  }

  console.error("[ai-image] request failed", openaiImageHost(), lastError);
  throw new AiError("Не удалось нарисовать картинку. Попробуйте ещё раз.", 502);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function openaiVisualBrief(args: {
  topic: string;
  niche: string;
  images: { mimeType: string; bytes: Buffer }[];
  timeoutMs?: number;
}): Promise<string> {
  if (!args.images.length) return "";
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 60_000);
  const content = [
    {
      type: "text",
      text: [
        "Посмотри референсы автора. Опиши визуальный язык для новой картинки Instagram-поста.",
        "3–6 коротких предложений: композиция, свет, плотность, мотивы, чего избегать.",
        "Не цитируй текст с картинок и не предлагай надписи. Это не карусель.",
        `Тема: ${args.topic}`,
        `Ниша: ${args.niche || "экспертный контент"}`,
      ].join("\n"),
    },
    ...args.images.slice(0, 4).map((image) => ({
      type: "image_url",
      image_url: {
        url: `data:${image.mimeType};base64,${image.bytes.toString("base64")}`,
      },
    })),
  ];

  try {
    const response = await postChatTryingVariants(
      chatBodiesForRequest([{ role: "user", content }], false, 400),
      key,
      controller.signal,
    );
    if (!response.ok) {
      const body = await response.text();
      console.error("[ai-vision] skip brief", openaiHost(), response.status, body.slice(0, 200));
      return "";
    }
    // Через readStreamedContent, а не response.json(): chatBody включает
    // `stream: true` всем подряд, и обычный разбор JSON здесь молча падал,
    // оставляя бриф пустым (см. комментарий в chatBody).
    return (await readStreamedContent(response)).slice(0, 800);
  } catch (error) {
    console.error("[ai-vision] brief failed", openaiHost(), error);
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function openaiCarouselRecipe(args: {
  images: { mimeType: string; bytes: Buffer }[];
  timeoutMs?: number;
}): Promise<Record<string, unknown> | null> {
  if (!args.images.length) return null;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 60_000);
  const content = [
    {
      type: "text",
      text: [
        "Это первые слайды чужих или своих Instagram-каруселей. Нужен JSON-рецепт композиции для текстовой карусели.",
        "Текст, логотипы и лица не копируй. Смотри только сетку: куда поставлен текст, какое геометрическое пятно, светлый или тёмный фон.",
        "family: poster (пятно в углу), band (полоса сверху или сбоку), centered (центр).",
        "decor: blob | band-top | dot | rail | none.",
        "closer: accent (весь финал в акценте) или split (низ акцентный).",
        "Числа в процентах, кроме decorScale 0.7–1.35.",
        'JSON: { "family": "poster", "align": "left", "paper": "light", "decor": "blob", "decorX": 86, "decorY": 10, "decorScale": 1, "textY": 40, "showIndex": true, "closer": "accent" }',
      ].join("\n"),
    },
    ...args.images.slice(0, 2).map((image) => ({
      type: "image_url",
      image_url: {
        url: `data:${image.mimeType};base64,${image.bytes.toString("base64")}`,
      },
    })),
  ];

  try {
    // Перебор форм запроса тут общий: раньше был свой повтор только для
    // JSON-режима, и форма параметров при смене провайдера оставалась чужой.
    const response = await postChatTryingVariants(
      chatBodiesForRequest([{ role: "user", content }], true, 400),
      key,
      controller.signal,
    );
    if (!response.ok) {
      const body = await response.text();
      console.error("[ai-vision] skip recipe", openaiHost(), response.status, body.slice(0, 200));
      return null;
    }
    // См. openaiVisualBrief: ответ приходит потоком, обычный response.json() тут
    // молча ронял рецепт в null, и референсы переставали влиять на карусель.
    const contentText = await readStreamedContent(response);
    if (!contentText) return null;
    return JSON.parse(stripFence(contentText)) as Record<string, unknown>;
  } catch (error) {
    console.error("[ai-vision] recipe failed", openaiHost(), error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function imageRequestBodies(model: string, prompt: string, size: string) {
  if (/^gpt-image/i.test(model)) {
    return [
      { model, prompt, n: 1, size },
    ];
  }
  return [
    { model, prompt, n: 1, size, response_format: "b64_json" },
    { model, prompt, n: 1, size },
  ];
}

async function postImage(body: unknown, key: string, endpoint: string, signal: AbortSignal) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    signal,
    body: JSON.stringify(body),
  });
}

async function imagePayloadToPng(payload: Record<string, unknown>): Promise<Buffer | null> {
  const rows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.images)
      ? payload.images
      : [];
  const first = rows[0] && typeof rows[0] === "object" ? rows[0] as Record<string, unknown> : {};
  const b64 = String(first.b64_json || first.b64 || first.base64 || "").trim();
  if (b64) return Buffer.from(b64, "base64");

  const url = String(first.url || payload.url || "").trim();
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}
