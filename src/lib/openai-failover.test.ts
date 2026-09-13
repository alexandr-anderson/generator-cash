import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, openaiJson, openaiModels } from "./openai";

/**
 * Проверяет перебор моделей из п. 50 (docs/work-plan.md): если первая модель
 * отвалилась у шлюза, генерация должна уехать на следующую, а не упасть.
 *
 * Отказ первой модели воспроизводим тем же ответом, который дал AiHubMix
 * 2026-09-13 на четырёх моделях из каталога: `400 no_available_channel`.
 */

const OK_BODY = JSON.stringify({
  choices: [{ message: { content: '{"text":"Готовый текст"}' } }],
});

const NO_CHANNEL = JSON.stringify({
  error: { code: "no_available_channel", message: "no available channel" },
});

function jsonResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

/** Модель, на которую ушёл каждый запрос, по порядку. */
function modelsFromCalls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => {
    const init = call[1] as RequestInit;
    return (JSON.parse(String(init.body)) as { model: string }).model;
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = "https://example.test/v1";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_MODEL;
});

describe("openaiModels", () => {
  it("разбирает список через запятую и чистит пробелы", () => {
    process.env.OPENAI_MODEL = " gpt-4.1-mini-free , gpt-4o-free ,, gpt-4.1-free ";
    expect(openaiModels()).toEqual(["gpt-4.1-mini-free", "gpt-4o-free", "gpt-4.1-free"]);
  });

  it("без настройки — честная ошибка, а не молчаливый дефолт", () => {
    delete process.env.OPENAI_MODEL;
    expect(() => openaiModels()).toThrow(AiError);
  });
});

describe("openaiJson: перебор моделей", () => {
  it("уходит на вторую модель, когда первой нет у шлюза", async () => {
    process.env.OPENAI_MODEL = "gpt-4.1-mini-free,gpt-4o-free";
    fetchMock
      .mockResolvedValueOnce(jsonResponse(NO_CHANNEL, 400))
      .mockResolvedValueOnce(jsonResponse(NO_CHANNEL, 400))
      .mockResolvedValueOnce(jsonResponse(NO_CHANNEL, 400))
      .mockResolvedValueOnce(jsonResponse(NO_CHANNEL, 400))
      .mockResolvedValueOnce(jsonResponse(OK_BODY));

    const out = await openaiJson<{ text: string }>({ system: "s", user: "u" });

    expect(out.text).toBe("Готовый текст");
    const used = modelsFromCalls(fetchMock);
    expect(used[0]).toBe("gpt-4.1-mini-free");
    expect(used[used.length - 1]).toBe("gpt-4o-free");
  });

  it("не перебирает модели при отклонённом ключе — он один на всех", async () => {
    process.env.OPENAI_MODEL = "gpt-4.1-mini-free,gpt-4o-free";
    fetchMock.mockResolvedValue(jsonResponse("{}", 401));

    await expect(openaiJson({ system: "s", user: "u" })).rejects.toThrow(/Ключ модели отклонён/);

    // Ровно один заход: вторую модель пробовать бессмысленно, и это скрыло бы
    // настоящую причину (битый ключ в секретах, 2026-09-13).
    expect(new Set(modelsFromCalls(fetchMock)).size).toBe(1);
  });

  it("перебирает и при сетевом сбое первой модели", async () => {
    process.env.OPENAI_MODEL = "gpt-4.1-mini-free,gpt-4o-free";
    fetchMock
      .mockRejectedValueOnce(new Error("connect ETIMEDOUT"))
      .mockResolvedValueOnce(jsonResponse(OK_BODY));

    const out = await openaiJson<{ text: string }>({ system: "s", user: "u" });

    expect(out.text).toBe("Готовый текст");
    expect(modelsFromCalls(fetchMock)).toEqual(["gpt-4.1-mini-free", "gpt-4o-free"]);
  });

  it("когда все модели легли — отдаёт ошибку последней, а не молчит", async () => {
    process.env.OPENAI_MODEL = "gpt-4.1-mini-free,gpt-4o-free";
    fetchMock.mockResolvedValue(jsonResponse("{}", 500));

    await expect(openaiJson({ system: "s", user: "u" })).rejects.toThrow(AiError);
  });

  it("живой прогресс отдаёт только первая попытка — иначе тексты склеятся", async () => {
    process.env.OPENAI_MODEL = "gpt-4.1-mini-free,gpt-4o-free";
    const chunks: string[] = [];
    fetchMock
      .mockResolvedValueOnce(jsonResponse(JSON.stringify({ choices: [{ message: { content: "битый" } }] })))
      .mockResolvedValueOnce(jsonResponse(OK_BODY));

    const out = await openaiJson<{ text: string }>({
      system: "s",
      user: "u",
      onDelta: (chunk) => chunks.push(chunk),
    });

    expect(out.text).toBe("Готовый текст");
    // "битый" — от первой попытки; текста второй в прогрессе быть не должно.
    expect(chunks.join("")).not.toContain("Готовый текст");
  });
});
