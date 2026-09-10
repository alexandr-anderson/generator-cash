import { describe, expect, it } from "vitest";
import { readableTail } from "./stream-preview";

describe("readableTail", () => {
  it("показывает строку, которую модель печатает прямо сейчас", () => {
    expect(readableTail('{"scenarios":[{"name":"Крючок","slides":["Постоянная устал')).toBe(
      "Постоянная устал",
    );
  });

  it("не показывает служебные ключи", () => {
    const out = readableTail('{"caption":"Текст подписи"}');
    expect(out).toBe("Текст подписи");
    expect(out).not.toContain("caption");
  });

  it("не показывает служебные имена сценариев", () => {
    const out = readableTail('{"scenarios":[{"name":"slides","slides":["Живой текст"');
    expect(out).toContain("Живой текст");
  });

  it("склеивает несколько готовых строк", () => {
    expect(readableTail('{"slides":["Раз","Два","Три"')).toBe("Раз · Два · Три");
  });

  it("разворачивает экранированные переводы строк в пробелы", () => {
    expect(readableTail('{"caption":"Первая\\nвторая"')).toBe("Первая вторая");
  });

  it("переживает экранированную кавычку внутри строки", () => {
    expect(readableTail('{"caption":"Он сказал \\"да\\" вчера"')).toBe('Он сказал "да" вчера');
  });

  it("обрезает длинный хвост, оставляя конец", () => {
    const long = "а".repeat(300);
    const out = readableTail(`{"caption":"${long}`, 50);
    expect(out.startsWith("…")).toBe(true);
    expect(out.length).toBe(51);
  });

  it("не падает на пустом и на мусоре", () => {
    expect(readableTail("")).toBe("");
    expect(readableTail("{[,,")).toBe("");
  });
});
