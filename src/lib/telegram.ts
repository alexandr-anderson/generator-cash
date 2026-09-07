export const TELEGRAM_ALERTS_USERNAME = "mr_anderson_say";

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export function parseTelegramUsername(raw = process.env.TELEGRAM_CHAT) {
  const value = (raw || "").trim().replace(/^@/, "");
  return value || TELEGRAM_ALERTS_USERNAME;
}

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

function apiUrl(method: string) {
  return `https://api.telegram.org/bot${botToken()}/${method}`;
}

async function telegramFetch(method: string, body?: Record<string, unknown>) {
  const response = await fetch(apiUrl(method), {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: unknown;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
}

type TelegramUpdate = {
  message?: {
    chat?: { id?: number; type?: string };
    from?: { username?: string };
  };
};

export async function resolveTelegramChatId() {
  const fromEnv = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (fromEnv) return fromEnv;

  const username = parseTelegramUsername().toLowerCase();
  const me = (await telegramFetch("getMe")) as { username?: string };
  const updates = (await telegramFetch("getUpdates", { limit: 100, timeout: 0 })) as TelegramUpdate[];
  const list = updates || [];
  const match = [...list].reverse().find(
    (item) => item.message?.from?.username?.toLowerCase() === username && item.message?.chat?.id,
  );
  if (match?.message?.chat?.id) return String(match.message.chat.id);
  const anyPrivate = [...list].reverse().find((item) => item.message?.chat?.id);
  if (anyPrivate?.message?.chat?.id) return String(anyPrivate.message.chat.id);
  const botName = me.username || "bot";
  throw new Error(`Нет чата. Откройте https://t.me/${botName} и нажмите Start (аккаунт @${username}).`);
}

export async function sendTelegramMessage(text: string) {
  if (!telegramConfigured()) return { ok: false as const, error: "TELEGRAM_BOT_TOKEN missing" };
  const chatId = await resolveTelegramChatId();
  await telegramFetch("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 3900),
    disable_web_page_preview: true,
  });
  return { ok: true as const };
}
