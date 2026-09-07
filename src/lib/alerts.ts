import { sendTelegramMessage, telegramConfigured } from "./telegram";

export type AlertKind = "generation" | "payment" | "site_down" | "site_up";

export const ALERT_COOLDOWN_MS: Record<AlertKind, number> = {
  generation: 20 * 60 * 1000,
  payment: 15 * 60 * 1000,
  site_down: 30 * 60 * 1000,
  site_up: 0,
};

const lastSent = new Map<AlertKind, number>();

export function shouldSendAlert(lastSentAt: number | undefined, now: number, cooldownMs: number) {
  if (!lastSentAt) return true;
  return now - lastSentAt >= cooldownMs;
}

export function errorText(caught: unknown) {
  if (caught instanceof Error && caught.message.trim()) return caught.message.trim().slice(0, 300);
  return "неизвестная ошибка";
}

export function formatAlertMessage(kind: AlertKind, detail: string) {
  const titles: Record<AlertKind, string> = {
    generation: "postvmeste.ru · генерация",
    payment: "postvmeste.ru · оплата",
    site_down: "postvmeste.ru · сайт",
    site_up: "postvmeste.ru · сайт",
  };
  const lead: Record<AlertKind, string> = {
    generation: "Генерация сыпется",
    payment: "Платёж не прошёл",
    site_down: "Сайт не отвечает или health не ок",
    site_up: "Снова в строю",
  };
  return [titles[kind], lead[kind], detail.trim()].filter(Boolean).join("\n");
}

export async function notifyAlert(kind: AlertKind, detail: string) {
  if (!telegramConfigured()) return { ok: false as const, skipped: "unconfigured" as const };
  const now = Date.now();
  if (!shouldSendAlert(lastSent.get(kind), now, ALERT_COOLDOWN_MS[kind])) {
    return { ok: false as const, skipped: "cooldown" as const };
  }
  try {
    await sendTelegramMessage(formatAlertMessage(kind, detail));
    lastSent.set(kind, now);
    return { ok: true as const };
  } catch (caught) {
    console.error("[telegram]", errorText(caught));
    return { ok: false as const, skipped: "send" as const };
  }
}

export function notifyGenerationFailure(source: string, caught: unknown) {
  void notifyAlert("generation", `${source}: ${errorText(caught)}`);
}

export function notifyPaymentFailure(detail: string) {
  void notifyAlert("payment", detail);
}
