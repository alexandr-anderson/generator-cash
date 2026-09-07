export type UptimeSnapshot = {
  consecutiveFails: number;
  alertedDown: boolean;
};

export const UPTIME_FAIL_THRESHOLD = 2;

export function nextUptimeSnapshot(
  previous: UptimeSnapshot,
  healthy: boolean,
): UptimeSnapshot & { notify: "down" | "up" | null } {
  if (healthy) {
    return {
      consecutiveFails: 0,
      alertedDown: false,
      notify: previous.alertedDown ? "up" : null,
    };
  }

  const consecutiveFails = previous.consecutiveFails + 1;
  const shouldAlertDown = !previous.alertedDown && consecutiveFails >= UPTIME_FAIL_THRESHOLD;
  return {
    consecutiveFails,
    alertedDown: previous.alertedDown || shouldAlertDown,
    notify: shouldAlertDown ? "down" : null,
  };
}

export function parseHealthPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { healthy: false, detail: "пустой ответ health" };
  }
  const data = payload as { ok?: unknown; database?: unknown; mail?: unknown };
  const database = String(data.database || "unknown");
  const mail = String(data.mail || "unknown");
  if (data.ok === true) return { healthy: true, detail: `БД ${database}, почта ${mail}` };
  return { healthy: false, detail: `health ok=false, БД ${database}, почта ${mail}` };
}
