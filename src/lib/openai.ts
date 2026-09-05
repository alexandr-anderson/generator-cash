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
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function openaiBaseUrl() {
  return (process.env.OPENAI_BASE_URL || "https://codex-free.com/v1").replace(/\/$/, "");
}

export function openaiModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
}

export function openaiImageModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
}

export function openaiImageKey() {
  return process.env.OPENAI_IMAGE_API_KEY?.trim() || "";
}

export function openaiImageConfigured() {
  return Boolean(openaiImageKey() && openaiImageGenerationsUrl());
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
    let response = await postChat(chatBody(messages, jsonMode, args.maxTokens), key, controller.signal);

    if (response.status === 400 && jsonMode) {
      const firstBody = await response.text();
      console.error("[ai] 400, retry without json mode", openaiHost(), firstBody.slice(0, 400));
      response = await postChat(chatBody(messages, false, args.maxTokens), key, controller.signal);
    }

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

    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown }; finish_reason?: string }[];
      output_text?: string;
    };
    const content = pickMessageContent(payload);
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

function isGpt5(model: string) {
  return /^gpt-5/i.test(model);
}

function chatBody(
  messages: { role: string; content: unknown }[],
  jsonMode: boolean,
  maxTokens?: number,
) {
  const model = openaiModel();
  const body: Record<string, unknown> = { model, messages };
  if (isGpt5(model)) {
    body.max_completion_tokens = maxTokens ?? 1600;
  } else {
    body.temperature = 0.7;
    body.max_tokens = maxTokens ?? 1600;
  }
  if (jsonMode) body.response_format = { type: "json_object" };
  return body;
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
    const response = await postChat(
      chatBody([{ role: "user", content }], false, 400),
      key,
      controller.signal,
    );
    if (!response.ok) {
      const body = await response.text();
      console.error("[ai-vision] skip brief", openaiHost(), response.status, body.slice(0, 200));
      return "";
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      output_text?: string;
    };
    return pickMessageContent(payload).slice(0, 800);
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
    let response = await postChat(
      chatBody([{ role: "user", content }], true, 400),
      key,
      controller.signal,
    );
    if (response.status === 400) {
      const firstBody = await response.text();
      console.error("[ai-vision] recipe 400, retry", openaiHost(), firstBody.slice(0, 200));
      response = await postChat(
        chatBody([{ role: "user", content }], false, 400),
        key,
        controller.signal,
      );
    }
    if (!response.ok) {
      const body = await response.text();
      console.error("[ai-vision] skip recipe", openaiHost(), response.status, body.slice(0, 200));
      return null;
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      output_text?: string;
    };
    const contentText = pickMessageContent(payload);
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
