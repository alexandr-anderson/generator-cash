#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HEALTH_URL = (process.env.HEALTH_URL || "https://postvmeste.ru/api/health").trim();
const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const CHAT_ID = (process.env.TELEGRAM_CHAT_ID || "").trim();
const CHAT = (process.env.TELEGRAM_CHAT || "mr_anderson_say").trim().replace(/^@/, "");
const STATE_FILE = process.env.UPTIME_STATE_FILE || path.join(__dirname, "..", ".uptime-state.json");
const FAIL_THRESHOLD = 2;

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
  const updates = await telegramApi("getUpdates", { limit: 100, timeout: 0 });
  const match = [...(updates || [])].reverse().find(
    (item) => item.message?.from?.username?.toLowerCase() === CHAT.toLowerCase() && item.message?.chat?.id,
  );
  if (!match) throw new Error(`Нет чата с @${CHAT}: напишите боту /start`);
  return String(match.message.chat.id);
}

async function sendTelegram(kind, detail) {
  if (!TOKEN) {
    console.log("==> uptime-check: TELEGRAM_BOT_TOKEN missing, skip notify");
    return;
  }
  const title = kind === "up" ? "Снова в строю" : "Сайт не отвечает или health не ок";
  const text = [`postvmeste.ru · сайт`, title, detail].join("\n").slice(0, 3900);
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

async function main() {
  const previous = loadState();
  const result = await ping();
  const next = nextSnapshot(previous, result.healthy);
  saveState({ consecutiveFails: next.consecutiveFails, alertedDown: next.alertedDown });
  console.log(`==> uptime-check: healthy=${result.healthy} notify=${next.notify || "none"} ${result.detail}`);
  if (next.notify) {
    await sendTelegram(next.notify, `${HEALTH_URL}\n${result.detail}`);
  }
}

main().catch((error) => {
  console.error("==> uptime-check failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
