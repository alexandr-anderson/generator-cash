import { describe, expect, it } from "vitest";
import { captionTxt, reelScriptTxt } from "./export-package";

describe("caption.txt", () => {
  it("joins caption and hashtags with a blank line", () => {
    expect(captionTxt({
      caption: "Как расти в Instagram",
      hashtags: ["#личныйбренд", "маркетинг"],
    })).toBe("Как расти в Instagram\n\n#личныйбренд маркетинг");
  });

  it("omits empty parts", () => {
    expect(captionTxt({ caption: "Только текст", hashtags: [] })).toBe("Только текст");
    expect(captionTxt({ caption: "", hashtags: ["#a"] })).toBe("#a");
  });
});

describe("reel.txt", () => {
  it("uses the reel script when present", () => {
    expect(reelScriptTxt({
      reelScript: "Хук и три тезиса",
      slides: [{ text: "Хук на обложке" }],
      caption: "Подпись",
    })).toBe("Хук и три тезиса");
  });

  it("falls back to cover hook then caption", () => {
    expect(reelScriptTxt({ slides: [{ text: "Хук" }], caption: "Подпись" })).toBe("Хук");
    expect(reelScriptTxt({ caption: "Подпись" })).toBe("Подпись");
  });
});
