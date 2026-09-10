import { describe, expect, it } from "vitest";
import { chatBodies } from "./openai";

// Форму запроса раньше выбирала эвристика по имени модели, и из-за этого
// обещание «смена провайдера — это замена секретов» было неправдой: достаточно
// назвать модель иначе, и ей уходил не тот набор параметров. Эти тесты держат
// договорённость, что имя модели больше ни на что не влияет.
const messages = [{ role: "user", content: "привет" }];

describe("chatBodies", () => {
  it("не смотрит на имя модели: варианты одинаковы для любой", () => {
    const strip = (list: Record<string, unknown>[]) =>
      list.map((body) => ({ ...body, model: "<любая>" }));

    expect(strip(chatBodies("chatgpt-5.6", messages, true, 100)))
      .toEqual(strip(chatBodies("claude-sonnet-5", messages, true, 100)));
    expect(strip(chatBodies("gpt-5.5", messages, true, 100)))
      .toEqual(strip(chatBodies("flux-pro-1.1", messages, true, 100)));
  });

  it("первым пробует современную форму: без temperature", () => {
    const [first] = chatBodies("любая", messages, true, 100);
    expect(first.max_completion_tokens).toBe(100);
    expect(first).not.toHaveProperty("temperature");
    expect(first).not.toHaveProperty("max_tokens");
  });

  it("вторым — прежнюю форму, для шлюзов постарше", () => {
    const [, second] = chatBodies("любая", messages, true, 100);
    expect(second.max_tokens).toBe(100);
    expect(second.temperature).toBe(0.7);
    expect(second).not.toHaveProperty("max_completion_tokens");
  });

  it("в JSON-режиме сначала обе формы с ним, потом обе без него", () => {
    const list = chatBodies("любая", messages, true, 100);
    expect(list).toHaveLength(4);
    expect(list.slice(0, 2).every((b) => b.response_format)).toBe(true);
    expect(list.slice(2).every((b) => !b.response_format)).toBe(true);
  });

  it("без JSON-режима остаются только две формы параметров", () => {
    const list = chatBodies("любая", messages, false, 100);
    expect(list).toHaveLength(2);
    expect(list.every((b) => !b.response_format)).toBe(true);
  });

  it("стрим включён во всех вариантах — на нём держится живое соединение", () => {
    for (const body of chatBodies("любая", messages, true, 100)) {
      expect(body.stream).toBe(true);
    }
  });

  it("модель и сообщения переносятся в каждый вариант без изменений", () => {
    for (const body of chatBodies("chatgpt-5.6", messages, true)) {
      expect(body.model).toBe("chatgpt-5.6");
      expect(body.messages).toEqual(messages);
    }
  });

  it("без явного лимита подставляет общий предел", () => {
    const [first] = chatBodies("любая", messages, true);
    expect(first.max_completion_tokens).toBe(1600);
  });
});
