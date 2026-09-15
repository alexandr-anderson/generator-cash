/**
 * Автосохранение работы в архив из редактора (п. 48 в docs/work-plan.md).
 *
 * Раньше работа сохранялась только изнутри экспорта: ушёл со страницы, не скачав, —
 * пропала потраченная генерация и все правки; скачал дважды — в архиве две
 * одинаковые работы (`/api/works` делал `create` на каждый экспорт).
 *
 * Теперь первое сохранение создаёт запись, следующие её обновляют. Правки копятся
 * `delayMs` и уходят одним запросом; сохранения идут строго по очереди — иначе
 * правка, пришедшая, пока летит создание, создала бы вторую запись.
 */

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type SaveApi<W> = {
  create: (work: W) => Promise<string>;
  update: (id: string, work: W) => Promise<void>;
};

export function createWorkAutosaver<W>(
  api: SaveApi<W>,
  options: { delayMs?: number; onStatus?: (status: SaveStatus) => void } = {},
) {
  const delayMs = options.delayMs ?? 800;
  let id: string | null = null;
  let pending: W | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let lastError: unknown = null;
  let inFlight = 0;
  let generation = 0;

  function run() {
    if (timer) clearTimeout(timer);
    timer = null;
    const work = pending;
    pending = null;
    if (work === null) return chain;
    const startedIn = generation;
    inFlight += 1;
    options.onStatus?.("saving");
    chain = chain.then(async () => {
      // Работа успела смениться (новая генерация) — старые правки в новую запись не пишем.
      if (startedIn !== generation) return;
      try {
        if (id) await api.update(id, work);
        else id = await api.create(work);
        lastError = null;
        if (startedIn === generation) options.onStatus?.(pending === null ? "saved" : "saving");
      } catch (error) {
        lastError = error;
        if (startedIn === generation) options.onStatus?.("error");
      } finally {
        inFlight -= 1;
      }
    });
    return chain;
  }

  return {
    /** Правка работы: сохранить через `delayMs`, если за это время не придёт следующая. */
    schedule(work: W) {
      pending = work;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    /** Сохранить немедленно и дождаться. Бросает, если последнее сохранение не удалось. */
    async flush() {
      await run();
      if (lastError) throw lastError;
      return id;
    },
    /** Новая генерация — дальше это другая работа и другая запись в архиве. */
    reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
      id = null;
      lastError = null;
      generation += 1;
      options.onStatus?.("idle");
    },
    /** Работа открыта из архива — правки обновляют её запись, а не создают новую. */
    resume(existingId: string) {
      this.reset();
      id = existingId;
    },
    /** Есть правки, которые ещё не дошли до сервера. */
    hasUnsaved() {
      return pending !== null || inFlight > 0;
    },
  };
}
