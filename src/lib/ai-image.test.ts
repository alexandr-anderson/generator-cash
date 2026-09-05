import { describe, expect, it } from "vitest";
import { buildPostImagePrompt } from "./ai-image-prompt";

describe("buildPostImagePrompt", () => {
  it("forbids typography and keeps the topic as a metaphor", () => {
    const prompt = buildPostImagePrompt({
      topic: "Охваты не равны доверию",
      niche: "Маркетинг",
      tone: "спокойный и уверенный",
      angle: "Тезис",
      hint: "спокойный кадр",
      colors: ["#ff5c35"],
      textExcerpt: "Не пишите это на картинке",
    });

    expect(prompt).toMatch(/no text/i);
    expect(prompt).toContain("Охваты не равны доверию");
    expect(prompt).toContain("Тезис");
    expect(prompt).toContain("Маркетинг");
    expect(prompt).not.toMatch(/write the caption/i);
  });
});
