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
    expect(variants[0].slides).toHaveLength(7);
  });

  it("does not pad a one-slide preview into a carousel", () => {
    const preview: ComposedCopy = {
      ...copy,
      scenarios: copy.scenarios.map((item) => ({ name: item.name, slides: [item.slides[0]] })),
    };
    const variants = generateVariants("carousel", "Охваты", preview.text, undefined, null, [], preview);
    expect(variants[0].slides).toHaveLength(1);
    expect(variants[0].slides[0].text).toBe("Охваты не равны доверию");
  });

  it("keeps a post as a single slide", () => {
    const postCopy: ComposedCopy = {
      ...copy,
      scenarios: copy.scenarios.map((item) => ({ name: item.name, slides: [item.slides[0]] })),
    };
    const variants = generateVariants("post", "Охваты", postCopy.text, undefined, null, [], postCopy);
    expect(variants).toHaveLength(3);
    expect(variants.every((item) => item.slides.length === 1)).toBe(true);
  });
});
