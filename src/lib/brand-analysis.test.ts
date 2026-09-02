import { describe, expect, it } from "vitest";
import {
  analyzeBrandSources,
  measureReference,
  profileToGenerationBrief,
} from "./brand-analysis";

function solidPixels(width: number, height: number, r: number, g: number, b: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = 255;
  }
  return { width, height, data };
}

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

describe("analyzeBrandSources", () => {
  it("creates evidence-backed editable traits from filenames when pixels are missing", () => {
    const profile = analyzeBrandSources(
      [
        { name: "cover-01.png", type: "image/png", size: 2048 },
        { name: "carousel-02.jpg", type: "image/jpeg", size: 4096 },
      ],
      "Studio Alex",
    );

    expect(profile.name).toBe("Studio Alex");
    expect(profile.approved).toBe(false);
    expect(profile.colors).toHaveLength(4);
    expect(profile.traits).toHaveLength(4);
    expect(profile.traits.every((trait) => trait.evidence.length > 0)).toBe(true);
    expect(profile.traits[0].evidence[0].source).toBe("cover-01.png");
  });

  it("is deterministic for the same source manifest", () => {
    const sources = [{ name: "same.webp", type: "image/webp", size: 1000 }];
    expect(analyzeBrandSources(sources, "A")).toEqual(analyzeBrandSources(sources, "A"));
  });

  it("adapts palette and voice to warm vs cool reference pixels", () => {
    const warm = measureReference(
      { name: "warm-cover.png", type: "image/png", size: 1200 },
      splitPixels(32, 48, [240, 90, 40], [250, 240, 220]),
    );
    const cool = measureReference(
      { name: "cool-cover.png", type: "image/png", size: 1200 },
      splitPixels(32, 48, [30, 90, 170], [10, 20, 40]),
    );

    const warmProfile = analyzeBrandSources([warm], "Warm Studio");
    const coolProfile = analyzeBrandSources([cool], "Cool Studio");

    expect(warmProfile.colors[0]).not.toBe(coolProfile.colors[0]);
    expect(warmProfile.traits.find((trait) => trait.id === "voice")?.value).toMatch(/Тёплый|контрастный|живой/i);
    expect(coolProfile.summary).toContain("Cool Studio");
    expect(profileToGenerationBrief(warmProfile)).toContain("#");
  });

  it("reads composition from vertical frames", () => {
    const vertical = measureReference(
      { name: "reel.png", type: "image/png", size: 800 },
      solidPixels(9, 16, 40, 40, 40),
    );
    const profile = analyzeBrandSources([vertical], "Reel Brand");
    expect(profile.traits.find((trait) => trait.id === "composition")?.value).toMatch(/Вертикальный/);
  });
});
