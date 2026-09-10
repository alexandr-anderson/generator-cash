/**
 * Отличает «у одного человека не получилось» от «шлюз лёг».
 *
 * Зачем отдельно от обычного алерта про генерацию: 2026-09-10 шлюз картинок
 * `codex.sale` весь вечер отвечал `503`, и пост с обложкой нельзя было создать
 * вообще — а узнали мы об этом только потому, что сами полезли проверять.
 * Обычный алерт про сбой генерации такого не показывает: он одинаково звучит и
 * когда сбой разовый, и когда продукт стоит.
 *
 * Активно опрашивать шлюзы нельзя — заход к текстовому стоит около двух минут и
 * жжёт лимиты бесплатного тарифа. Поэтому считаем **подряд идущие** отказы на
 * настоящих запросах пользователей: несколько подряд — значит лежит не у одного.
 *
 * Счётчики живут в памяти процесса (PM2 `instances: 1, exec_mode: "fork"`), как и
 * лимиты в `rate-limit.ts`. Появится второй инстанс — считать придётся снаружи.
 */

export type Gateway = "text" | "image";

/** Сколько отказов подряд считаем доказательством, что дело не в одном запросе. */
export const FAILURES_BEFORE_DOWN = 3;

type State = { failures: number; down: boolean };

const state = new Map<Gateway, State>();

function get(gateway: Gateway): State {
  const current = state.get(gateway);
  if (current) return current;
  const fresh: State = { failures: 0, down: false };
  state.set(gateway, fresh);
  return fresh;
}

export type GatewayVerdict =
  | { alert: "none" }
  | { alert: "down"; gateway: Gateway; failures: number }
  | { alert: "up"; gateway: Gateway };

/**
 * Отмечает отказ. Возвращает `down` ровно один раз — на том заходе, когда шлюз
 * официально признан лежащим, чтобы не слать одно и то же на каждый запрос.
 */
export function recordGatewayFailure(gateway: Gateway): GatewayVerdict {
  const current = get(gateway);
  current.failures += 1;

  if (!current.down && current.failures >= FAILURES_BEFORE_DOWN) {
    current.down = true;
    return { alert: "down", gateway, failures: current.failures };
  }
  return { alert: "none" };
}

/**
 * Отмечает успех. Возвращает `up` только если шлюз до этого был признан лежащим —
 * то есть о выздоровлении сообщаем лишь тем, кому сообщали о болезни.
 */
export function recordGatewaySuccess(gateway: Gateway): GatewayVerdict {
  const current = get(gateway);
  const wasDown = current.down;
  current.failures = 0;
  current.down = false;
  return wasDown ? { alert: "up", gateway } : { alert: "none" };
}

/** Только для тестов: вернуть счётчики в исходное состояние. */
export function resetGatewayHealth() {
  state.clear();
}

export const GATEWAY_LABEL: Record<Gateway, string> = {
  text: "шлюз текста",
  image: "шлюз картинок",
};
