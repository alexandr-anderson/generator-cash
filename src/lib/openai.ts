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
  messages: { role: string; content: string }[],
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
