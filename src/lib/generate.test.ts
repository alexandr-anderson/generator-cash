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
    expect(variants[0].recipe?.family).toBe("poster");
  });

  it("reuses a rubric recipe for every carousel variant", () => {
    const recipe = {
      version: 1 as const,
      sourceFileIds: ["ref-1"],
      family: "band" as const,
      align: "left" as const,
      paper: "dark" as const,
      decor: "band-top" as const,
      decorX: 50,
      decorY: 8,
      decorScale: 1,
      textY: 34,
      showIndex: true,
      closer: "split" as const,
    };
    const variants = generateVariants(
      "carousel",
      "Охваты",
      copy.text,
      { id: "r1", name: "Продукт", createdAt: 1, carouselRecipe: recipe },
      null,
      [],
      copy,
      recipe,
    );
    expect(variants.map((item) => item.layout)).toEqual(["band", "band", "band"]);
    expect(variants.every((item) => item.recipe?.family === "band")).toBe(true);
    expect(JSON.stringify(variants[0].recipe)).not.toBe(JSON.stringify(variants[1].recipe));
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

  it("keeps a post as a single slide with its own caption", () => {
    const postCopy: ComposedCopy = {
      text: "Смысл важнее охватов.",
      caption: "Общая подпись",
      hashtags: ["#контент"],
      scenarios: [
        { name: "Тезис", slides: ["Охваты не равны доверию"], caption: "Подпись тезиса" },
        { name: "Вопрос", slides: ["Зачем вам чужие охваты?"], caption: "Подпись вопроса" },
        { name: "Совет", slides: ["Сначала смысл, потом просмотры"], caption: "Подпись совета" },
      ],
    };
    const variants = generateVariants("post", "Охваты", postCopy.text, undefined, null, [], postCopy);
    expect(variants).toHaveLength(3);
    expect(variants.every((item) => item.slides.length === 1)).toBe(true);
    expect(variants.map((item) => item.eyebrow)).toEqual(["Тезис", "Вопрос", "Совет"]);
    expect(variants[0].caption).toBe("Смысл важнее охватов.");
    expect(variants[1].caption).toBe("Смысл важнее охватов.");
    expect(variants[2].slides[0].text).toBe("");
  });

  it("keeps a generated photo on a post slide", () => {
    const postCopy: ComposedCopy = {
      text: "Смысл важнее охватов.",
      caption: "Общая подпись",
      hashtags: ["#контент"],
      scenarios: [
        { name: "Тезис", slides: ["не должно попасть на кадр"], caption: "Подпись", imageUrl: "/api/files/img-1" },
        { name: "Вопрос", slides: [""], caption: "Подпись 2", imageUrl: "/api/files/img-2" },
        { name: "Совет", slides: [""], caption: "Подпись 3", imageUrl: "/api/files/img-3" },
      ],
    };
    const variants = generateVariants("post", "Охваты", postCopy.text, undefined, null, [], postCopy);
    expect(variants[0].slides[0].imageUrl).toBe("/api/files/img-1");
    expect(variants[0].slides[0].text).toBe("");
  });

  it("keeps hook text on a reel cover photo", () => {
    const reelCopy: ComposedCopy = {
      text: "Хватит украшать пустое",
      caption: "Оффер важнее картинки",
      hashtags: ["#reels"],
      reelScript: "Хватит украшать пустое",
      scenarios: [
        { name: "Провокация", slides: ["Хватит украшать пустое"], imageUrl: "/api/files/r1" },
        { name: "Дыра", slides: ["Дыру не закроет визуал"], imageUrl: "/api/files/r2" },
        { name: "Обещание", slides: ["Сначала смысл"], imageUrl: "/api/files/r3" },
      ],
    };
    const variants = generateVariants("reel", "Оффер важнее картинки", "", undefined, null, [], reelCopy);
    expect(variants).toHaveLength(3);
    expect(variants.map((item) => item.eyebrow)).toEqual(["Провокация", "Дыра", "Обещание"]);
    expect(variants[0].slides[0].imageUrl).toBe("/api/files/r1");
    expect(variants[0].slides[0].text).toBe("Хватит украшать пустое");
    expect(variants[0].caption).toBe("Оффер важнее картинки");
    expect(variants[0].reelScript).toBe("Хватит украшать пустое");
  });
});
