import { describe, expect, it } from "vitest";
import { analyzeBrandSources } from "./brand-analysis";
import {
  createDirections,
  creativeToSvg,
  duplicateForFormat,
  getCanvasSize,
} from "./creative";

const profile = {
  ...analyzeBrandSources(
    [{ name: "reference.png", type: "image/png", size: 1000 }],
    "Test brand",
  ),
  approved: true,
};

const brief = {
  topic: "Пять ошибок личного бренда",
  audience: "Креаторы",
  goal: "Сохранения",
  cta: "Сохраните",
  mood: "Уверенно",
};

describe("creative generation", () => {
  it("builds three distinct directions from an approved profile", () => {
    const directions = createDirections(profile, brief);
    expect(directions).toHaveLength(3);
    expect(new Set(directions.map((item) => item.format)).size).toBe(3);
    expect(directions.every((item) => item.slides.length === 5)).toBe(true);
  });

  it("duplicates a direction without mutating its content", () => {
    const [creative] = createDirections(profile, brief);
    const carousel = duplicateForFormat(creative, "carousel");
    expect(carousel.format).toBe("carousel");
    expect(carousel.headline).toBe(creative.headline);
    expect(creative.format).toBe("reel");
  });

  it("renders safe SVG and correct platform dimensions", () => {
    const [creative] = createDirections(profile, {
      ...brief,
      topic: "Как <создать> & вырасти",
    });
    const svg = creativeToSvg(creative);
    expect(svg).toContain('width="1080" height="1920"');
    expect(svg).toContain("&lt;создать&gt; &amp;");
    expect(getCanvasSize("post")).toEqual({ width: 1080, height: 1350 });
  });
});
