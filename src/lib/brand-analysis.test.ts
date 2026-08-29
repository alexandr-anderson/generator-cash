import { describe, expect, it } from "vitest";
import { analyzeBrandSources } from "./brand-analysis";

describe("analyzeBrandSources", () => {
  it("creates evidence-backed editable traits", () => {
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
});
