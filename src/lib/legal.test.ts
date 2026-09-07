import { describe, expect, it } from "vitest";
import { parseRegisterConsent } from "./legal";

describe("parseRegisterConsent", () => {
  it("accepts only an explicit true flag", () => {
    expect(parseRegisterConsent({ consent: true })).toBe(true);
    expect(parseRegisterConsent({ consent: "true" })).toBe(false);
    expect(parseRegisterConsent({ consent: false })).toBe(false);
    expect(parseRegisterConsent({})).toBe(false);
    expect(parseRegisterConsent(null)).toBe(false);
  });
});
