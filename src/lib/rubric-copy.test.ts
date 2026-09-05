import { describe, expect, it } from "vitest";
import { deleteRubricCopy, worksCountLabel } from "./rubric-copy";

describe("rubric copy", () => {
  it("picks the right noun form", () => {
    expect(worksCountLabel(1)).toBe("1 работа");
    expect(worksCountLabel(2)).toBe("2 работы");
    expect(worksCountLabel(5)).toBe("5 работ");
    expect(worksCountLabel(21)).toBe("21 работа");
  });

  it("keeps archive works when deleting a rubric", () => {
    expect(deleteRubricCopy("Ошибки", 3)).toContain("3 работы останутся в архиве без рубрики");
    expect(deleteRubricCopy("Кейсы", 0)).not.toContain("архиве");
  });
});
