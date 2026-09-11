import { describe, expect, it } from "vitest";
import { generationsGenitive, pluralRu } from "./plural";

describe("pluralRu", () => {
  it("выбирает форму по последней цифре", () => {
    expect(pluralRu(1, "работа", "работы", "работ")).toBe("работа");
    expect(pluralRu(3, "работа", "работы", "работ")).toBe("работы");
    expect(pluralRu(7, "работа", "работы", "работ")).toBe("работ");
    expect(pluralRu(21, "работа", "работы", "работ")).toBe("работа");
  });

  it("держит исключение для второго десятка", () => {
    expect(pluralRu(11, "работа", "работы", "работ")).toBe("работ");
    expect(pluralRu(14, "работа", "работы", "работ")).toBe("работ");
    expect(pluralRu(111, "работа", "работы", "работ")).toBe("работ");
  });

  it("считает ноль как множественное", () => {
    expect(pluralRu(0, "работа", "работы", "работ")).toBe("работ");
  });
});

describe("generationsGenitive", () => {
  it("ставит слово в родительный падеж после числа", () => {
    // Самое частое состояние бесплатного аккаунта: «осталось 0 из 1 генерации».
    expect(generationsGenitive(1)).toBe("генерации");
    expect(generationsGenitive(5)).toBe("генераций");
    expect(generationsGenitive(50)).toBe("генераций");
  });
});
