import { describe, expect, it } from "vitest";
import { analyzeBrandSources, measureReference } from "./brand-analysis";
import {
  createDirections,
  creativeToSvg,
  duplicateForFormat,
  getCanvasSize,
} from "./creative";

function splitPixels(
  width: number,
  height: number,
  left: [number, number, number],
  right: [number, number, number],
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const [r, g, b] = x < width / 2 ? left : right;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

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
    expect(directions.every((item) => item.layout)).toBeTruthy();
    expect(directions[0].brandLabel).toBe("Test brand");
    expect(directions[0].accent).toBe(profile.colors[0]);
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
    expect(svg).toContain("&lt;создать&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("Test brand");
    expect(getCanvasSize("post")).toEqual({ width: 1080, height: 1350 });
  });

  it("paints creatives with colors sampled from references", () => {
    const sampled = analyzeBrandSources(
      [
        measureReference(
          { name: "reel.png", type: "image/png", size: 1800 },
          splitPixels(18, 32, [240, 80, 30], [250, 245, 230]),
        ),
      ],
      "Coral Author",
    );
    const [creative] = createDirections({ ...sampled, approved: true }, brief);
    expect(creative.brandLabel).toBe("Coral Author");
    expect(creativeToSvg(creative)).toContain(creative.accent);
    expect(creative.slides[1]).toBe("Одна мысль");
  });
});
