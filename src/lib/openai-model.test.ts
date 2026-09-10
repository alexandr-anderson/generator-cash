import { afterEach, describe, expect, it } from "vitest";
import {
  AiError,
  openaiConfigured,
  openaiImageModel,
  openaiImageModelOrEmpty,
  openaiModel,
  openaiModelOrEmpty,
} from "./openai";

// Запасное значение модели дважды скрывало отсутствие настройки: прод работал не
// на той модели, которую мы считали заданной, и никто не жаловался. Эти тесты
// держат договорённость, что молчаливого дефолта больше нет.
const KEY = "OPENAI_API_KEY";
const MODEL = "OPENAI_MODEL";
const IMAGE_MODEL = "OPENAI_IMAGE_MODEL";
const saved = {
  key: process.env[KEY],
  model: process.env[MODEL],
  imageModel: process.env[IMAGE_MODEL],
};

afterEach(() => {
  if (saved.key === undefined) delete process.env[KEY];
  else process.env[KEY] = saved.key;
  if (saved.model === undefined) delete process.env[MODEL];
  else process.env[MODEL] = saved.model;
  if (saved.imageModel === undefined) delete process.env[IMAGE_MODEL];
  else process.env[IMAGE_MODEL] = saved.imageModel;
});

describe("openaiModel", () => {
  it("возвращает заданную модель", () => {
    process.env[MODEL] = "chatgpt-5.6";
    expect(openaiModel()).toBe("chatgpt-5.6");
  });

  it("обрезает пробелы вокруг значения", () => {
    process.env[MODEL] = "  chatgpt-5.6  ";
    expect(openaiModel()).toBe("chatgpt-5.6");
  });

  it("падает, а не подставляет модель, когда настройки нет", () => {
    delete process.env[MODEL];
    expect(() => openaiModel()).toThrow(AiError);
  });

  it("пустую строку считает отсутствием настройки", () => {
    process.env[MODEL] = "   ";
    expect(() => openaiModel()).toThrow(/OPENAI_MODEL/);
  });

  it("для диагностики отдаёт пустую строку вместо исключения", () => {
    delete process.env[MODEL];
    expect(openaiModelOrEmpty()).toBe("");
  });
});

describe("openaiConfigured", () => {
  it("требует и ключ, и модель", () => {
    process.env[KEY] = "cpa_test";
    process.env[MODEL] = "chatgpt-5.6";
    expect(openaiConfigured()).toBe(true);
  });

  it("без модели считается ненастроенным — health скажет об этом сразу", () => {
    process.env[KEY] = "cpa_test";
    delete process.env[MODEL];
    expect(openaiConfigured()).toBe(false);
  });

  it("без ключа считается ненастроенным", () => {
    delete process.env[KEY];
    process.env[MODEL] = "chatgpt-5.6";
    expect(openaiConfigured()).toBe(false);
  });
});

describe("openaiImageModel", () => {
  it("возвращает заданную модель картинок", () => {
    process.env[IMAGE_MODEL] = "gpt-image-2";
    expect(openaiImageModel()).toBe("gpt-image-2");
  });

  it("падает, а не подставляет gpt-image-2, когда настройки нет", () => {
    delete process.env[IMAGE_MODEL];
    expect(() => openaiImageModel()).toThrow(/OPENAI_IMAGE_MODEL/);
  });

  it("для диагностики отдаёт пустую строку вместо исключения", () => {
    delete process.env[IMAGE_MODEL];
    expect(openaiImageModelOrEmpty()).toBe("");
  });
});
