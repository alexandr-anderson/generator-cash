import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./alerts", () => ({ notifyGenerationFailure: vi.fn() }));

import { buildFallbackImagePrompt, buildImageSceneRequest, type ImageSceneInput } from "./ai-image-prompt";
import { notifyGenerationFailure } from "./alerts";
import { createImageWithFallback, detectImageMime } from "./image-fallback";
import { AiError } from "./openai";

/**
 * Запасной шлюз картинок из п. 50 (docs/work-plan.md): основная модель упала →
 * текстовая модель пишет сцену → запасная модель рисует, и об этом приходит алерт.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

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

let fetchMock: ReturnType<typeof vi.fn>;

function setFallbackEnv() {
  process.env.IMAGE_FALLBACK_BASE_URL = "https://fallback.test/v1";
  process.env.IMAGE_FALLBACK_API_KEY = "fallback-key";
  process.env.IMAGE_FALLBACK_MODEL = "tongyi-mai/z-image-turbo";
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "text-key";
  process.env.OPENAI_BASE_URL = "https://text.test/v1";
  process.env.OPENAI_MODEL = "gpt-4.1-mini-free";
  fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith("https://text.test/")) {
      return json({ choices: [{ message: { content: '{"scene":"A calm wooden desk with a yellow mug."}' } }] });
    }
    if (url.startsWith("https://fallback.test/")) {
      return json({ data: [{ b64_json: JPEG.toString("base64") }] });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(notifyGenerationFailure).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.IMAGE_FALLBACK_BASE_URL;
  delete process.env.IMAGE_FALLBACK_API_KEY;
  delete process.env.IMAGE_FALLBACK_MODEL;
});

describe("createImageWithFallback", () => {
  it("основная ответила — запасная не трогается", async () => {
    setFallbackEnv();
    const state = { active: false };
    const out = await createImageWithFallback({ primary: async () => PNG, scene: SCENE, state });

    expect(out).toBe(PNG);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.active).toBe(false);
    expect(notifyGenerationFailure).not.toHaveBeenCalled();
  });

  it("без настроенной запасной — ошибка основной как раньше", async () => {
    const primaryError = new AiError("Шлюз картинок оборвал ответ.", 502);
    await expect(createImageWithFallback({
      primary: async () => { throw primaryError; },
      scene: SCENE,
      state: { active: false },
    })).rejects.toBe(primaryError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("основная упала — сцена от текстовой модели уходит в запасную, приходит алерт", async () => {
    setFallbackEnv();
    const state = { active: false };
    const out = await createImageWithFallback({
      primary: async () => { throw new AiError("Модель временно недоступна.", 429); },
      scene: SCENE,
      state,
    });

    expect(out.equals(JPEG)).toBe(true);
    expect(state.active).toBe(true);
    expect(notifyGenerationFailure).toHaveBeenCalledTimes(1);

    const [textCall, imageCall] = fetchMock.mock.calls;
    expect(String(textCall[0])).toContain("https://text.test/");
    expect(String(imageCall[0])).toBe("https://fallback.test/v1/images/generations");
    const init = imageCall[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fallback-key");
    const body = JSON.parse(String(init.body)) as { model: string; prompt: string; size: string };
    expect(body.model).toBe("tongyi-mai/z-image-turbo");
    expect(body.size).toBe("1024x1024");
    expect(body.prompt).toBe("A calm wooden desk with a yellow mug. Editorial photograph, square 1:1.");
  });

  it("после первого сбоя остальные картинки поста сразу идут на запасную", async () => {
    setFallbackEnv();
    const primary = vi.fn(async () => PNG);
    await createImageWithFallback({ primary, scene: SCENE, state: { active: true } });
    expect(primary).not.toHaveBeenCalled();
  });

  it("запасная тоже упала — наружу ошибка основной, её и чинить", async () => {
    setFallbackEnv();
    fetchMock.mockImplementation(async (url: string) => (
      url.startsWith("https://text.test/")
        ? json({ choices: [{ message: { content: '{"scene":"A desk."}' } }] })
        : json({}, 401)
    ));
    const primaryError = new AiError("Ключ картинок отклонён. Проверьте OPENAI_IMAGE_API_KEY.", 502);
    await expect(createImageWithFallback({
      primary: async () => { throw primaryError; },
      scene: SCENE,
      state: { active: false },
    })).rejects.toBe(primaryError);
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
