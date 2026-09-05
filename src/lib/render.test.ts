import { describe, expect, it } from "vitest";
import { carouselSlideRole, slideToSvg } from "./render";
import type { CreativeWork } from "./types";

function work(layout: CreativeWork["layout"], slides = 7): CreativeWork {
  return {
    id: "w1",
    format: "carousel",
    rubricId: null,
    topic: "Охваты",
    slides: Array.from({ length: slides }, (_, i) => ({
      text: i === 0 ? "Охваты растут, а доверия нет?" : `Мысль ${i + 1}`,
      fontSize: 48,
      textColor: "#191817",
      positionX: 50,
      positionY: 50,
    })),
    caption: "Охваты растут, а доверия нет?",
    hashtags: ["#охваты"],
    layout,
    background: "#f6f1e9",
    accent: "#ff5c35",
    foreground: "#191817",
    eyebrow: "Крючок → Разбор → CTA",
    brandLabel: "riveralexander",
    createdAt: 1,
  };
}

describe("carouselSlideRole", () => {
  it("marks cover, body and closer", () => {
    expect(carouselSlideRole(0, 7)).toBe("cover");
    expect(carouselSlideRole(3, 7)).toBe("body");
    expect(carouselSlideRole(6, 7)).toBe("closer");
    expect(carouselSlideRole(0, 1)).toBe("cover");
  });
});

describe("slideToSvg", () => {
  it("does not print internal scenario names", () => {
    const svg = slideToSvg(work("poster"), 0);
    expect(svg).not.toContain("Крючок");
    expect(svg).not.toContain("Разбор");
    expect(svg).not.toContain("CTA");
    expect(svg).toContain("Охваты растут");
  });

  it("keeps three layouts visually different", () => {
    const poster = slideToSvg(work("poster"), 0);
    const band = slideToSvg(work("band"), 0);
    const centered = slideToSvg(work("centered"), 0);
    expect(poster).toContain("<circle");
    expect(band).toContain('height="189"');
    expect(centered).toContain('cx="540"');
    expect(poster).not.toContain('height="189"');
    expect(poster).not.toBe(band);
  });

  it("fills the last poster slide with the accent", () => {
    const closer = slideToSvg(work("poster"), 6);
    expect(closer).toContain('fill="#ff5c35"');
    expect(closer).not.toContain("<circle");
  });

  it("keeps a dark band closer with an accent panel", () => {
    const closer = slideToSvg(work("band"), 6);
    expect(closer).toContain('fill="#f6f1e9"');
    expect(closer).toContain('y="783"');
  });
});
