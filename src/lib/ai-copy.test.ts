import { describe, expect, it } from "vitest";
import { normalizeComposedCopy, normalizeExpandedSlides, normalizeHashtags } from "./ai-copy";

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

  it("keeps a single slide for a post", () => {
    const copy = normalizeComposedCopy(
      {
        text: "Сначала оффер, потом креатив.",
        caption: "Сначала оффер",
        hashtags: ["оффер"],
        scenarios: [{ slides: ["Сначала оффер, потом креатив"] }],
      },
      { format: "post", topic: "Оффер" },
    );

    expect(copy.scenarios[0].slides).toHaveLength(1);
    expect(copy.reelScript).toBeUndefined();
  });
});
