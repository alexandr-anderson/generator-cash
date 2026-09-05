import { describe, expect, it } from "vitest";
import { composePostFromAuthorText, composeReelFromHooks, normalizeComposedCopy, normalizeExpandedSlides, normalizeHashtags, normalizeReelHooks } from "./ai-copy";

describe("normalizeHashtags", () => {
  it("adds hash, drops empties, caps at 15", () => {
    const tags = normalizeHashtags(["маркетинг", "#личныйбренд", "  ", "#маркетинг"]);
    expect(tags[0]).toBe("#маркетинг");
    expect(tags).toContain("#личныйбренд");
    expect(tags.length).toBeGreaterThanOrEqual(10);
    expect(tags.length).toBeLessThanOrEqual(15);
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe("normalizeComposedCopy", () => {
  it("keeps one preview slide per carousel scenario", () => {
    const copy = normalizeComposedCopy(
      {
        text: "Эксперты часто путают охваты и доверие. Сначала смысл, потом охваты.",
        caption: "Листайте карусель",
        hashtags: ["#контент", "#личныйбренд"],
        scenarios: [
          { name: "Крючок → Разбор → CTA", slides: ["Крючок"] },
          { name: "Миф → Правда → CTA", slides: ["Миф", "Правда"] },
        ],
      },
      { format: "carousel", topic: "Охваты не равны доверию", slideCount: 1 },
    );

    expect(copy.scenarios).toHaveLength(3);
    expect(copy.scenarios[0].slides).toHaveLength(1);
    expect(copy.scenarios[0].slides[0]).toBe("Крючок");
    expect(copy.scenarios[1].name).toBe("Миф → Правда → CTA");
    expect(copy.scenarios[2].name).toBe("Ошибка → Решение → CTA");
    expect(copy.caption).toContain("Листайте");
    expect(copy.hashtags[0].startsWith("#")).toBe(true);
  });

  it("keeps the chosen first slide when expanding a carousel", () => {
    const slides = normalizeExpandedSlides(
      ["Другой крючок", "Разбор 1", "Разбор 2"],
      "Охваты не равны доверию",
      "Охваты",
      "Сначала смысл, потом охваты. Потом доверие.",
      "Крючок → Разбор → CTA",
    );
    expect(slides).toHaveLength(7);
    expect(slides[0]).toBe("Охваты не равны доверию");
  });

  it("keeps the author caption on every post variant", () => {
    const copy = composePostFromAuthorText({
      topic: "Оффер",
      text: "Сначала оффер, потом креатив.",
      niche: "Маркетинг",
    });

    expect(copy.scenarios).toHaveLength(3);
    expect(copy.scenarios.map((item) => item.name)).toEqual(["Тезис", "Вопрос", "Совет"]);
    expect(copy.caption).toBe("Сначала оффер, потом креатив.");
    expect(copy.scenarios.every((item) => item.caption === copy.caption)).toBe(true);
    expect(copy.reelScript).toBeUndefined();
  });
});

describe("normalizeReelHooks", () => {
  it("keeps three short hooks and pins the author hook first", () => {
    const hooks = normalizeReelHooks(
      ["Хватит снимать в лоб прямо сейчас пожалуйста", "Ошибку, о которой молчат", "Один кадр вместо десяти"],
      "Почему оффер важнее картинки",
      "Сначала смысл оффера",
    );
    expect(hooks).toHaveLength(3);
    expect(hooks[0]).toBe("Сначала смысл оффера");
    expect(hooks[1].split(" ").length).toBeLessThanOrEqual(6);
  });
});

describe("composeReelFromHooks", () => {
  it("builds three reel angles with the topic as caption", () => {
    const copy = composeReelFromHooks({
      topic: "Оффер важнее картинки",
      niche: "Маркетинг",
      hooks: ["Хватит украшать пустое", "Дыру в оффере не закроет визуал", "Сначала смысл"],
    });
    expect(copy.scenarios.map((item) => item.name)).toEqual(["Провокация", "Дыра", "Обещание"]);
    expect(copy.scenarios.every((item) => item.slides.length === 1)).toBe(true);
    expect(copy.caption).toBe("Оффер важнее картинки");
    expect(copy.reelScript).toBe("Хватит украшать пустое");
  });
});
