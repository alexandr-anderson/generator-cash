import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./telegram", () => ({
  telegramConfigured: vi.fn(() => true),
  sendTelegramMessage: vi.fn(),
}));
vi.mock("./mail", () => ({
  mailConfigured: vi.fn(() => true),
  sendAlertEmail: vi.fn(),
}));

import { notifyAlert } from "./alerts";
import { mailConfigured, sendAlertEmail } from "./mail";
import { sendTelegramMessage, telegramConfigured } from "./telegram";

/**
 * С сервера Timeweb api.telegram.org закрыт: 2026-09-15 `fetch` падал с
 * UND_ERR_CONNECT_TIMEOUT и по IPv4, и по IPv6, а в логе копились
 * `[telegram] fetch failed` — алерты не доходили. Запасной канал — почта.
 */

beforeEach(() => {
  vi.resetModules();
  vi.mocked(telegramConfigured).mockReturnValue(true);
  vi.mocked(mailConfigured).mockReturnValue(true);
  vi.mocked(sendTelegramMessage).mockReset();
  vi.mocked(sendAlertEmail).mockReset();
});

describe("notifyAlert: запасной канал", () => {
  it("Telegram не прошёл — алерт уходит письмом", async () => {
    vi.mocked(sendTelegramMessage).mockRejectedValue(new Error("fetch failed"));

    const result = await notifyAlert("payment", "платёж не прошёл");

    expect(result).toMatchObject({ ok: true, channel: "mail" });
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(sendAlertEmail).mock.calls[0][0])).toContain("платёж не прошёл");
  });

  it("Telegram прошёл — письма нет", async () => {
    vi.mocked(sendTelegramMessage).mockResolvedValue({ ok: true });

    const result = await notifyAlert("site_up", "снова в строю");

    expect(result).toMatchObject({ ok: true, channel: "telegram" });
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("Telegram не настроен — сразу письмо", async () => {
    vi.mocked(telegramConfigured).mockReturnValue(false);

    const result = await notifyAlert("site_down", "health не ок");

    expect(result).toMatchObject({ ok: true, channel: "mail" });
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("пока первый алерт ждёт таймаута Telegram, второй не дублирует письмо", async () => {
    let failTelegram: (error: Error) => void = () => {};
    vi.mocked(sendTelegramMessage).mockImplementationOnce(
      () => new Promise((_, reject) => { failTelegram = reject; }),
    );

    const first = notifyAlert("generation", "сбой 1");
    const second = await notifyAlert("generation", "сбой 2");
    failTelegram(new Error("UND_ERR_CONNECT_TIMEOUT"));
    await first;

    expect(second).toMatchObject({ ok: false, skipped: "cooldown" });
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
  });
});
