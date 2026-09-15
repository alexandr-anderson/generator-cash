import { mailConfigured, sendAlertEmail } from "./mail";
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

/**
 * Алерт: сначала Telegram, не вышло — письмом на почту поддержки.
 *
 * Почта — не «на всякий случай»: с сервера Timeweb api.telegram.org закрыт
 * (2026-09-15 `fetch` падал с UND_ERR_CONNECT_TIMEOUT и по IPv4, и по IPv6), и
 * алерты генерации не доходили вовсе. Из GitHub Actions Telegram при этом
 * работает — поэтому тестовый алерт uptime.yml и приходил.
 *
 * Интервал занимаем до отправки, а не после: таймаут Telegram ~10 с, и второй
 * сбой за это время прошёл бы проверку и продублировал письмо. Если не ушло ни
 * одним каналом — интервал возвращаем, чтобы следующий алерт не потерялся.
 */
export async function notifyAlert(kind: AlertKind, detail: string) {
  const telegram = telegramConfigured();
  const mail = mailConfigured();
  if (!telegram && !mail) return { ok: false as const, skipped: "unconfigured" as const };
  const now = Date.now();
  const previous = lastSent.get(kind);
  if (!shouldSendAlert(previous, now, ALERT_COOLDOWN_MS[kind])) {
    return { ok: false as const, skipped: "cooldown" as const };
  }
  lastSent.set(kind, now);
  const text = formatAlertMessage(kind, detail);

  if (telegram) {
    try {
      await sendTelegramMessage(text);
      return { ok: true as const, channel: "telegram" as const };
    } catch (caught) {
      console.error("[telegram]", errorText(caught));
    }
  }
  if (mail) {
    try {
      await sendAlertEmail(text);
      return { ok: true as const, channel: "mail" as const };
    } catch (caught) {
      console.error("[alert-mail]", errorText(caught));
    }
  }

  if (previous === undefined) lastSent.delete(kind);
  else lastSent.set(kind, previous);
  return { ok: false as const, skipped: "send" as const };
}

export function notifyGenerationFailure(source: string, caught: unknown) {
  void notifyAlert("generation", `${source}: ${errorText(caught)}`);
}

export function notifyPaymentFailure(detail: string) {
  void notifyAlert("payment", detail);
}
