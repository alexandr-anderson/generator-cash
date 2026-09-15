import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkAutosaver, type SaveStatus } from "./work-autosave";
import { workFields } from "./work-input";

/**
 * п. 48: работа жила только во вкладке и попадала в архив дублями — `/api/works`
 * делал `create` на каждый экспорт, а до экспорта не сохранялось ничего.
 */

type Work = { topic: string };

function fakeApi() {
  const calls: string[] = [];
  let seq = 0;
  return {
    calls,
    create: vi.fn(async (work: Work) => {
      calls.push(`create:${work.topic}`);
      await Promise.resolve();
      seq += 1;
      return `w${seq}`;
    }),
    update: vi.fn(async (id: string, work: Work) => {
      calls.push(`update:${id}:${work.topic}`);
    }),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createWorkAutosaver", () => {
  it("первое сохранение создаёт запись, следующие её обновляют — дублей нет", async () => {
    const api = fakeApi();
    const saver = createWorkAutosaver(api);

    saver.schedule({ topic: "черновик" });
    await saver.flush();
    saver.schedule({ topic: "правка" });
    await saver.flush();
    await saver.flush(); // второй экспорт подряд

    expect(api.calls).toEqual(["create:черновик", "update:w1:правка"]);
  });

  it("правки подряд уходят одним запросом после паузы", async () => {
    const api = fakeApi();
    const saver = createWorkAutosaver(api, { delayMs: 800 });

    saver.schedule({ topic: "а" });
    saver.schedule({ topic: "аб" });
    saver.schedule({ topic: "абв" });
    expect(api.create).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);

    expect(api.calls).toEqual(["create:абв"]);
  });

  it("правка, пришедшая пока летит создание, не создаёт вторую запись", async () => {
    const api = fakeApi();
    let releaseCreate: (id: string) => void = () => {};
    api.create.mockImplementationOnce((work: Work) => {
      api.calls.push(`create:${work.topic}`);
      return new Promise((resolve) => { releaseCreate = resolve; });
    });
    const saver = createWorkAutosaver(api);

    saver.schedule({ topic: "первое" });
    const first = saver.flush();
    saver.schedule({ topic: "второе" });
    const second = saver.flush();
    // Создание стартует в очереди микрозадач — дожидаемся, пока запрос «улетит».
    for (let i = 0; i < 10 && !api.calls.length; i += 1) await Promise.resolve();
    expect(api.calls).toEqual(["create:первое"]);
    releaseCreate("w1");
    await first;
    await second;

    expect(api.calls).toEqual(["create:первое", "update:w1:второе"]);
  });

  it("новая генерация — новая запись, а старые отложенные правки не пишутся", async () => {
    const api = fakeApi();
    const saver = createWorkAutosaver(api);
    saver.schedule({ topic: "первая работа" });
    await saver.flush();

    saver.schedule({ topic: "недописанная правка" });
    saver.reset();
    saver.schedule({ topic: "вторая работа" });
    await saver.flush();

    expect(api.calls).toEqual(["create:первая работа", "create:вторая работа"]);
  });

  it("сбой сохранения виден в статусе и в экспорте, следующая правка пробует снова", async () => {
    const api = fakeApi();
    api.create.mockRejectedValueOnce(new Error("Сеть недоступна"));
    const statuses: SaveStatus[] = [];
    const saver = createWorkAutosaver(api, { onStatus: (status) => statuses.push(status) });

    saver.schedule({ topic: "работа" });
    await expect(saver.flush()).rejects.toThrow("Сеть недоступна");
    expect(statuses.at(-1)).toBe("error");

    saver.schedule({ topic: "работа" });
    await expect(saver.flush()).resolves.toBe("w1");
    expect(statuses.at(-1)).toBe("saved");
  });

  it("работа из архива: правки обновляют её запись, новая не создаётся", async () => {
    const api = fakeApi();
    const saver = createWorkAutosaver(api);

    saver.resume("archived-7");
    saver.schedule({ topic: "поправили подпись" });
    await saver.flush();

    expect(api.calls).toEqual(["update:archived-7:поправили подпись"]);
  });

  it("пока правка не дошла до сервера — есть несохранённое", async () => {
    const api = fakeApi();
    const saver = createWorkAutosaver(api);
    expect(saver.hasUnsaved()).toBe(false);
    saver.schedule({ topic: "правка" });
    expect(saver.hasUnsaved()).toBe(true);
    await saver.flush();
    expect(saver.hasUnsaved()).toBe(false);
  });
});

describe("workFields", () => {
  it("подставляет значения по умолчанию и не пропускает формат и рубрику", () => {
    const fields = workFields({ format: "post", rubricId: "r1", topic: "", reelScript: 42 });
    expect(fields).toMatchObject({ topic: "Без темы", slides: [], hashtags: [], reelScript: null, layout: "poster" });
    expect(fields).not.toHaveProperty("format");
    expect(fields).not.toHaveProperty("rubricId");
  });
});
