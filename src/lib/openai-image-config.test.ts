import { describe, expect, it } from "vitest";
import { resolveImageGenerationsUrl } from "./openai";

describe("resolveImageGenerationsUrl", () => {
  it("accepts a full generations URL", () => {
    expect(resolveImageGenerationsUrl("https://api.example.com/v1/images/generations/"))
      .toBe("https://api.example.com/v1/images/generations");
  });

  it("appends generations to an /images root", () => {
    expect(resolveImageGenerationsUrl("https://api.example.com/v1/images"))
      .toBe("https://api.example.com/v1/images/generations");
  });

  it("appends the OpenAI-compatible path to a /v1 base", () => {
    expect(resolveImageGenerationsUrl("https://api.example.com/v1"))
      .toBe("https://api.example.com/v1/images/generations");
  });

  it("adds /v1/images/generations to a host root", () => {
    expect(resolveImageGenerationsUrl("https://api.example.com"))
      .toBe("https://api.example.com/v1/images/generations");
  });
});
