#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HEALTH_URL = (process.env.HEALTH_URL || "https://postvmeste.ru/api/health").trim();
const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const CHAT_ID = (process.env.TELEGRAM_CHAT_ID || "").trim();
const CHAT = (process.env.TELEGRAM_CHAT || "mr_anderson_say").trim().replace(/^@/, "");
const STATE_FILE = process.env.UPTIME_STATE_FILE || path.join(__dirname, "..", ".uptime-state.json");
// One run now decides on its own: it retries a few times before calling the
// site down, so a single blip no longer needs a second run hours later to be
// confirmed. Keep in sync with UPTIME_FAIL_THRESHOLD in src/lib/uptime-state.ts.
const FAIL_THRESHOLD = 1;
const PROBE_ATTEMPTS = Math.max(1, Number(process.env.UPTIME_PROBE_ATTEMPTS) || 3);
const PROBE_DELAY_MS = Math.max(0, Number(process.env.UPTIME_PROBE_DELAY_MS) || 15000);

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return {
      consecutiveFails: Number(raw.consecutiveFails) || 0,
      alertedDown: Boolean(raw.alertedDown),
    };
  } catch {
    return { consecutiveFails: 0, alertedDown: false };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

function nextSnapshot(previous, healthy) {
  if (healthy) {
    return {
      consecutiveFails: 0,
      alertedDown: false,
      notify: previous.alertedDown ? "up" : null,
    };
  }
  const consecutiveFails = previous.consecutiveFails + 1;
  const shouldAlertDown = !previous.alertedDown && consecutiveFails >= FAIL_THRESHOLD;
  return {
    consecutiveFails,
    alertedDown: previous.alertedDown || shouldAlertDown,
    notify: shouldAlertDown ? "down" : null,
  };
}

function parseHealth(payload) {
  if (!payload || typeof payload !== "object") {
    return { healthy: false, detail: "пустой ответ health" };
  }
  const database = String(payload.database || "unknown");
  const mail = String(payload.mail || "unknown");
  if (payload.ok === true) return { healthy: true, detail: `БД ${database}, почта ${mail}` };
  return { healthy: false, detail: `health ok=false, БД ${database}, почта ${mail}` };
}

async function telegramApi(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
}

async function resolveChatId() {
  if (CHAT_ID) return CHAT_ID;
  const me = await telegramApi("getMe");
  const botName = me.username || "bot";
  console.log(`==> uptime-check: bot @${botName}`);
  const updates = await telegramApi("getUpdates", { limit: 100, timeout: 0 });
  const list = updates || [];
  const byName = [...list].reverse().find(
    (item) => item.message?.from?.username?.toLowerCase() === CHAT.toLowerCase() && item.message?.chat?.id,
  );
  if (byName) return String(byName.message.chat.id);
  const anyPrivate = [...list].reverse().find((item) => item.message?.chat?.type === "private" && item.message?.chat?.id);
  if (anyPrivate) return String(anyPrivate.message.chat.id);
  throw new Error(`Нет чата. Откройте https://t.me/${botName} и нажмите Start (аккаунт @${CHAT}).`);
}

async function sendTelegram(kind, detail) {
  if (!TOKEN) {
    console.log("==> uptime-check: TELEGRAM_BOT_TOKEN missing, skip notify");
    return;
  }
  const titles = {
    up: "Снова в строю",
    down: "Сайт не отвечает или health не ок",
    test: "Тестовый алерт",
  };
  const text = [`postvmeste.ru · сайт`, titles[kind] || titles.down, detail].join("\n").slice(0, 3900);
  const chatId = await resolveChatId();
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

async function ping() {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(20000) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { healthy: false, detail: `HTTP ${response.status}` };
    }
    return parseHealth(payload);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "fetch failed";
    return { healthy: false, detail: message };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probe() {
  let last = { healthy: false, detail: "нет попыток" };
  for (let attempt = 1; attempt <= PROBE_ATTEMPTS; attempt += 1) {
    last = await ping();
    if (last.healthy) return { ...last, attempts: attempt };
    console.log(`==> uptime-check: попытка ${attempt}/${PROBE_ATTEMPTS} — ${last.detail}`);
    if (attempt < PROBE_ATTEMPTS) await sleep(PROBE_DELAY_MS);
  }
  return { ...last, attempts: PROBE_ATTEMPTS };
}

async function main() {
  if ((process.env.TELEGRAM_TEST || "").trim() === "1") {
    await sendTelegram("test", "Если это сообщение пришло — канал алертов работает.");
    console.log("==> uptime-check: test alert sent");
    return;
  }

  const previous = loadState();
  const result = await probe();
  const next = nextSnapshot(previous, result.healthy);
  saveState({ consecutiveFails: next.consecutiveFails, alertedDown: next.alertedDown });
  console.log(
    `==> uptime-check: healthy=${result.healthy} попыток=${result.attempts} notify=${next.notify || "none"} ${result.detail}`,
  );
  if (next.notify) {
    const detail = result.healthy
      ? result.detail
      : `${result.detail} (не ответил ${result.attempts} раз подряд)`;
    await sendTelegram(next.notify, `${HEALTH_URL}\n${detail}`);
  }
}

main().catch((error) => {
  console.error("==> uptime-check failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
