import { describe, expect, it } from "vitest";
import { legalVersionLabel, parseRegisterConsent } from "./legal";

describe("parseRegisterConsent", () => {
  it("accepts only an explicit true flag", () => {
    expect(parseRegisterConsent({ consent: true })).toBe(true);
    expect(parseRegisterConsent({ consent: "true" })).toBe(false);
    expect(parseRegisterConsent({ consent: false })).toBe(false);
    expect(parseRegisterConsent({})).toBe(false);
    expect(parseRegisterConsent(null)).toBe(false);
  });
});

describe("legalVersionLabel", () => {
  it("показывает дату по-человечески, без хвоста «г.»", () => {
    expect(legalVersionLabel("2026-09-11")).toBe("11 сентября 2026");
    expect(legalVersionLabel("2026-01-01")).toBe("1 января 2026");
  });
});
