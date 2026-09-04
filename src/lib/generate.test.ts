import { describe, expect, it } from "vitest";
import { generateVariants } from "./generate";
import type { ComposedCopy } from "./ai-types";

const copy: ComposedCopy = {
  text: "Сначала смысл, потом охваты.",
  caption: "Листайте — там разбор",
  hashtags: ["#контент", "#личныйбренд", "#маркетинг"],
  scenarios: [
    { name: "Крючок → Разбор → CTA", slides: ["Охваты не равны доверию", "2", "3", "4", "5", "6", "Сохраните"] },
    { name: "Миф → Правда → CTA", slides: ["Миф про охваты", "2", "3", "4", "5", "6", "Сохраните"] },
    { name: "Ошибка → Решение → CTA", slides: ["Ошибка: гнаться за ER", "2", "3", "4", "5", "6", "Сохраните"] },
  ],
};

describe("generateVariants", () => {
  it("uses AI slides, caption and three different layouts", () => {
    const variants = generateVariants("carousel", "Охваты", copy.text, undefined, null, [], copy);
    expect(variants).toHaveLength(3);
    expect(variants.map((item) => item.layout)).toEqual(["poster", "band", "centered"]);
    expect(variants[0].slides[0].text).toBe("Охваты не равны доверию");
    expect(variants[1].eyebrow).toBe("Миф → Правда → CTA");
    expect(variants[0].caption).toBe("Листайте — там разбор");
    expect(variants[2].hashtags).toContain("#маркетинг");
  });
});
