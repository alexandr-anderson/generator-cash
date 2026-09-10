import { afterEach, describe, expect, it } from "vitest";
import { AiError, openaiConfigured, openaiModel, openaiModelOrEmpty } from "./openai";

// Запасное значение модели дважды скрывало отсутствие настройки: прод работал не
// на той модели, которую мы считали заданной, и никто не жаловался. Эти тесты
// держат договорённость, что молчаливого дефолта больше нет.
const KEY = "OPENAI_API_KEY";
const MODEL = "OPENAI_MODEL";
const saved = { key: process.env[KEY], model: process.env[MODEL] };

afterEach(() => {
  if (saved.key === undefined) delete process.env[KEY];
  else process.env[KEY] = saved.key;
  if (saved.model === undefined) delete process.env[MODEL];
  else process.env[MODEL] = saved.model;
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
