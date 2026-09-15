import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./alerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./alerts")>()),
  notifyAlert: vi.fn(),
}));

import { buildFallbackImagePrompt, buildImageSceneRequest, type ImageSceneInput } from "./ai-image-prompt";
import { notifyAlert } from "./alerts";
import { createImagesWithFallback, detectImageMime, type ImageJob } from "./image-fallback";
import { AiError } from "./openai";
import { resetTextProviderHealth } from "./text-providers";

/**
 * Картинки поста с запасными шлюзами (п. 50, docs/work-plan.md): основная упала →
 * Pollinations по сцене от текстовой модели → codex.sale по обычному промпту,
 * одновременно для всех оставшихся картинок (он рисует 128–175 с на картинку).
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const POLLINATIONS_IMAGES = "https://gen.pollinations.ai/v1/images/generations";
const CODEX_IMAGES = "https://codex.sale/v1/images/generations";

const SCENE: ImageSceneInput = {
  topic: "Как не выгореть, ведя блог в одиночку",
  niche: "экспертный блог",
  angle: "Тезис",
  hint: "спокойный кадр",
  colors: ["#E8572A"],
  format: "square",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function jobs(primaries: Array<() => Promise<Buffer>>): ImageJob[] {
  return primaries.map((primary, index) => ({ primary, prompt: `основной промпт ${index + 1}`, size: "1024x1024", scene: SCENE }));
}

const ok = () => async () => PNG;
const fail = (error = new AiError("Модель временно недоступна.", 429)) => async (): Promise<Buffer> => { throw error; };

/** Ответы шлюзов по адресу; по умолчанию все живы. */
let routes: Record<string, () => Promise<Response>>;
let fetchMock: ReturnType<typeof vi.fn>;

function calledUrls() {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

beforeEach(() => {
  resetTextProviderHealth();
  process.env.OPENAI_BASE_URL = "https://text.test/v1";
  process.env.OPENAI_API_KEY = "text-key";
  process.env.OPENAI_MODEL = "gpt-4.1-mini-free";
  process.env.POLLINATIONS_API_KEY = "pollinations-key";
  process.env.CODEX_SALE_API_KEY = "codex-key";
  delete process.env.ZAI_API_KEY;
  routes = {
    "https://text.test/v1/chat/completions": async () => json({ choices: [{ message: { content: '{"scene":"A calm wooden desk."}' } }] }),
    [POLLINATIONS_IMAGES]: async () => json({ data: [{ b64_json: JPEG.toString("base64") }] }),
    [CODEX_IMAGES]: async () => json({ data: [{ b64_json: PNG.toString("base64") }] }),
  };
  fetchMock = vi.fn(async (url: string) => {
    const route = routes[String(url)];
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return route();
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(notifyAlert).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.POLLINATIONS_API_KEY;
  delete process.env.CODEX_SALE_API_KEY;
});

describe("createImagesWithFallback", () => {
  it("основная нарисовала всё — запасные не трогаются", async () => {
    const primary = vi.fn(async () => PNG);
    const out = await createImagesWithFallback(jobs([primary, primary, primary]), { pauseMs: 0 });

    expect(out).toEqual([PNG, PNG, PNG]);
    expect(primary).toHaveBeenCalledTimes(3);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(notifyAlert).not.toHaveBeenCalled();
  });

  it("запасных нет — ошибка основной, остальные картинки основной больше не дёргаются", async () => {
    delete process.env.POLLINATIONS_API_KEY;
    delete process.env.CODEX_SALE_API_KEY;
    const primaryError = new AiError("Шлюз картинок оборвал ответ.", 502);
    const later = vi.fn(async () => PNG);

    await expect(createImagesWithFallback(jobs([fail(primaryError), later, later]), { pauseMs: 0 })).rejects.toBe(primaryError);
    expect(later).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("основная упала на второй — хвост поста рисует Pollinations по сцене", async () => {
    const out = await createImagesWithFallback(jobs([ok(), fail(), ok()]), { pauseMs: 0 });

    expect(out.map(detectImageMime)).toEqual(["image/png", "image/jpeg", "image/jpeg"]);
    expect(calledUrls().filter((url) => url === POLLINATIONS_IMAGES)).toHaveLength(2);
    expect(calledUrls()).not.toContain(CODEX_IMAGES);
    const body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(body).toMatchObject({ model: "tongyi-mai/z-image-turbo", prompt: "A calm wooden desk. Editorial photograph, square 1:1." });
    expect(String(vi.mocked(notifyAlert).mock.calls[0][1])).toContain("выручили запасные — pollinations ×2");
  });

  it("Pollinations сломан — codex.sale рисует все оставшиеся одновременно, обычным промптом", async () => {
    routes[POLLINATIONS_IMAGES] = async () => json({ error: "bad key" }, 401);
    let inFlight = 0;
    let maxInFlight = 0;
    routes[CODEX_IMAGES] = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return json({ data: [{ b64_json: PNG.toString("base64") }] });
    };

    const out = await createImagesWithFallback(jobs([fail(), ok(), ok()]), { pauseMs: 0 });

    expect(out).toHaveLength(3);
    expect(maxInFlight).toBe(3);
    const codexCall = fetchMock.mock.calls.find(([url]) => String(url) === CODEX_IMAGES)!;
    const init = codexCall[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer codex-key");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "gpt-image-2", size: "1024x1024" });
    const prompts = fetchMock.mock.calls
      .filter(([url]) => String(url) === CODEX_IMAGES)
      .map(([, request]) => JSON.parse(String((request as RequestInit).body)).prompt)
      .sort();
    expect(prompts).toEqual(["основной промпт 1", "основной промпт 2", "основной промпт 3"]);
    const alert = String(vi.mocked(notifyAlert).mock.calls[0][1]);
    expect(alert).toContain("codex-sale ×3");
    expect(alert).toContain("pollinations: картинка: Ключ картинок отклонён. Проверьте POLLINATIONS_API_KEY.");
  });

  it("не выручил никто — наружу ошибка основной, в алерте причины всех шлюзов", async () => {
    routes[POLLINATIONS_IMAGES] = async () => json({}, 401);
    routes[CODEX_IMAGES] = async () => json({}, 403);
    const primaryError = new AiError("Модель временно недоступна.", 429);

    await expect(createImagesWithFallback(jobs([fail(primaryError), ok()]), { pauseMs: 0 })).rejects.toBe(primaryError);

    const alert = String(vi.mocked(notifyAlert).mock.calls[0][1]);
    expect(alert).toContain("запасные не выручили (не нарисовано 2 из 2)");
    expect(alert).toContain("gen.pollinations.ai HTTP 401");
    expect(alert).toContain("codex.sale HTTP 403");
  });

  it("сцена не получилась — Pollinations пропущен с причиной, выручает codex.sale", async () => {
    routes["https://text.test/v1/chat/completions"] = async () => json({ choices: [{ message: { content: '{"scene":""}' } }] });

    const out = await createImagesWithFallback(jobs([fail()]), { pauseMs: 0 });

    expect(out).toEqual([PNG]);
    expect(calledUrls()).not.toContain(POLLINATIONS_IMAGES);
    expect(String(vi.mocked(notifyAlert).mock.calls[0][1])).toContain("pollinations: сцена (текстовая модель): Модель текста вернула пустую сцену.");
  });

  it("не осталось времени — шлюзы пропускаются, а не рвут роут по таймауту", async () => {
    const primaryError = new AiError("Модель временно недоступна.", 429);
    await expect(createImagesWithFallback(jobs([fail(primaryError)]), { pauseMs: 0, budgetMs: 5_000 })).rejects.toBe(primaryError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(String(vi.mocked(notifyAlert).mock.calls[0][1])).toContain("не осталось времени");
  });
});

describe("detectImageMime", () => {
  it("узнаёт PNG, JPEG и WebP по первым байтам", () => {
    expect(detectImageMime(PNG)).toBe("image/png");
    expect(detectImageMime(JPEG)).toBe("image/jpeg");
    expect(detectImageMime(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "ascii"))).toBe("image/webp");
    expect(detectImageMime(Buffer.from("<svg"))).toBeNull();
  });
});

describe("промпт запасной модели", () => {
  it("просит одну сцену по-английски без запретов и передаёт тему и формат", () => {
    const { system, user } = buildImageSceneRequest({ ...SCENE, format: "vertical" });
    expect(system).toMatch(/Never use the words 'no', 'without', 'not'/);
    expect(system).toMatch(/JSON/);
    expect(user).toContain("Как не выгореть, ведя блог в одиночку");
    expect(user).toContain("vertical 9:16");
    expect(buildFallbackImagePrompt(" A chair. ", "vertical")).toBe("A chair. Editorial photograph, vertical 9:16, subject centered.");
  });
});
