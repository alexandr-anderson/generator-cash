import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./alerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./alerts")>()),
  notifyAlert: vi.fn(),
}));

import { notifyAlert } from "./alerts";
import { AiError, openaiJson } from "./openai";
import { attemptOrder, markUnavailable, resetTextProviderHealth, textProviders } from "./text-providers";

/**
 * Цепочка текстовых провайдеров: 2026-09-14 у ключа AiHubMix кончилась дневная
 * квота на всех моделях сразу (`429 reached the limit of the free model quota`),
 * и текст на проде встал целиком. Ответ `429` ниже — тот самый.
 */

const QUOTA = { error: { message: "Sorry, you have reached the limit of the free model quota." } };
const OK = { choices: [{ message: { content: '{"text":"Готово"}' } }] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function sse(chunks: string[]) {
  const body = chunks.map((piece) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** `host/model` каждого запроса по порядку. */
function calls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([url, init]) => {
    const model = (JSON.parse(String((init as RequestInit).body)) as { model: string }).model;
    return `${new URL(String(url)).host}/${model}`;
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetTextProviderHealth();
  process.env.OPENAI_BASE_URL = "https://primary.test/v1";
  process.env.OPENAI_API_KEY = "primary-key";
  process.env.OPENAI_MODEL = "free-a,free-b";
  process.env.ZAI_API_KEY = "zai-key";
  delete process.env.POLLINATIONS_API_KEY;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(notifyAlert).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ZAI_API_KEY;
  delete process.env.OPENAI_MODEL;
});

describe("textProviders", () => {
  it("основной первым, запасные — только с ключом", () => {
    const ids = textProviders({
      OPENAI_BASE_URL: "https://primary.test/v1/",
      OPENAI_API_KEY: "k",
      OPENAI_MODEL: " a , b ",
      POLLINATIONS_API_KEY: "p",
    });
    expect(ids.map((provider) => provider.id)).toEqual(["primary", "pollinations"]);
    expect(ids[0]).toMatchObject({ baseUrl: "https://primary.test/v1", models: ["a", "b"] });
  });

  it("основной без ключа пропускается, цепочка живёт на запасных", () => {
    expect(textProviders({ OPENAI_MODEL: "a", ZAI_API_KEY: "z" }).map((provider) => provider.id)).toEqual(["zai"]);
  });

  it("модели в паузе уходят в конец очереди, но не выпадают", () => {
    const providers = textProviders();
    markUnavailable("primary", "free-a", 60_000);
    const order = attemptOrder(providers).map(({ provider, model }) => `${provider.id}/${model}`);
    expect(order[0]).toBe("primary/free-b");
    expect(order[order.length - 1]).toBe("primary/free-a");
  });
});

describe("openaiJson: цепочка провайдеров", () => {
  it("квота кончилась у всех моделей основного — отвечает следующий провайдер, приходит алерт", async () => {
    fetchMock.mockImplementation(async (url: string) => (
      url.startsWith("https://primary.test/") ? json(QUOTA, 429) : json(OK)
    ));

    const out = await openaiJson<{ text: string }>({ system: "s", user: "u" });

    expect(out.text).toBe("Готово");
    expect(calls(fetchMock)).toEqual(["primary.test/free-a", "primary.test/free-b", "api.z.ai/glm-4.5-flash"]);
    // Z.AI без этого параметра сначала «думает»: 21 с вместо 5 на промпте карусели.
    const zaiBody = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body));
    expect(zaiBody.thinking).toEqual({ type: "disabled" });
    const primaryBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(primaryBody.thinking).toBeUndefined();
    expect(notifyAlert).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(notifyAlert).mock.calls[0][1])).toContain("ответил zai/glm-4.5-flash");
  });

  it("модель в квоте на следующем запросе не дёргается первой", async () => {
    fetchMock.mockImplementation(async (url: string) => (
      url.startsWith("https://primary.test/") ? json(QUOTA, 429) : json(OK)
    ));
    await openaiJson({ system: "s", user: "u" });
    fetchMock.mockClear();

    await openaiJson({ system: "s", user: "u" });

    expect(calls(fetchMock)[0]).toBe("api.z.ai/glm-4.5-flash");
  });

  it("отклонённый ключ пропускает остальные модели провайдера, но не цепочку", async () => {
    fetchMock.mockImplementation(async (url: string) => (
      url.startsWith("https://primary.test/") ? json({}, 401) : json(OK)
    ));

    await openaiJson({ system: "s", user: "u" });

    expect(calls(fetchMock)).toEqual(["primary.test/free-a", "api.z.ai/glm-4.5-flash"]);
  });

  it("живой текст отдаёт попытка, которая ответила, а не первая упавшая", async () => {
    fetchMock.mockImplementation(async (url: string) => (
      url.startsWith("https://primary.test/") ? json(QUOTA, 429) : sse(['{"text":', '"Готово"}'])
    ));
    const chunks: string[] = [];

    const out = await openaiJson<{ text: string }>({ system: "s", user: "u", onDelta: (chunk) => chunks.push(chunk) });

    expect(out.text).toBe("Готово");
    expect(chunks.join("")).toBe('{"text":"Готово"}');
  });

  it("легли все — наружу последняя ошибка", async () => {
    fetchMock.mockImplementation(async () => json(QUOTA, 429));
    await expect(openaiJson({ system: "s", user: "u" })).rejects.toBeInstanceOf(AiError);
    expect(notifyAlert).not.toHaveBeenCalled();
  });
});
