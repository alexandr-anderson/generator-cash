import { describe, expect, it } from "vitest";
import { captionTxt } from "./export-package";

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
