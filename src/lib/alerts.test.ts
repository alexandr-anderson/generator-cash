import { describe, expect, it } from "vitest";
import { errorText, formatAlertMessage, shouldSendAlert } from "./alerts";
import { nextUptimeSnapshot, parseHealthPayload } from "./uptime-state";

describe("alert cooldown", () => {
  it("allows the first alert and blocks inside the window", () => {
    expect(shouldSendAlert(undefined, 1000, 60_000)).toBe(true);
    expect(shouldSendAlert(1000, 30_000, 60_000)).toBe(false);
    expect(shouldSendAlert(1000, 61_000, 60_000)).toBe(true);
  });
});

describe("alert text", () => {
  it("formats a generation failure", () => {
    expect(formatAlertMessage("generation", "compose: timeout")).toContain("генерация");
    expect(formatAlertMessage("generation", "compose: timeout")).toContain("compose: timeout");
    expect(errorText(new Error("Модель не ответила"))).toBe("Модель не ответила");
  });
});

describe("uptime snapshot", () => {
  it("alerts down only after two consecutive failures", () => {
    const first = nextUptimeSnapshot({ consecutiveFails: 0, alertedDown: false }, false);
    expect(first).toMatchObject({ consecutiveFails: 1, alertedDown: false, notify: null });
    const second = nextUptimeSnapshot(first, false);
    expect(second).toMatchObject({ consecutiveFails: 2, alertedDown: true, notify: "down" });
    const still = nextUptimeSnapshot(second, false);
    expect(still.notify).toBeNull();
  });

  it("sends recovery once after a down alert", () => {
    const up = nextUptimeSnapshot({ consecutiveFails: 4, alertedDown: true }, true);
    expect(up).toEqual({ consecutiveFails: 0, alertedDown: false, notify: "up" });
    expect(nextUptimeSnapshot(up, true).notify).toBeNull();
  });
});

describe("health payload", () => {
  it("treats ok true as healthy", () => {
    expect(parseHealthPayload({ ok: true, database: "ok", mail: "ok" }).healthy).toBe(true);
    expect(parseHealthPayload({ ok: false, database: "error", mail: "ok" })).toMatchObject({
      healthy: false,
    });
  });
});
