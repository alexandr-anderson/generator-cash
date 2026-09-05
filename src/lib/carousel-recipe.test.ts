import { describe, expect, it } from "vitest";
import {
  defaultCarouselRecipe,
  isRecipeStale,
  normalizeCarouselRecipe,
  nudgeCarouselRecipe,
  recipeSourceKey,
} from "./carousel-recipe";

describe("carousel recipe", () => {
  it("normalizes a vision payload and keeps source files", () => {
    const recipe = normalizeCarouselRecipe(
      { family: "centered", align: "center", paper: "dark", decor: "dot", decorX: 200, textY: 10, closer: "split" },
      ["b", "a"],
    );
    expect(recipe.family).toBe("centered");
    expect(recipe.align).toBe("center");
    expect(recipe.paper).toBe("dark");
    expect(recipe.decorX).toBe(92);
    expect(recipe.textY).toBe(28);
    expect(recipe.sourceFileIds).toEqual(["b", "a"]);
  });

  it("treats a recipe as stale when references change", () => {
    const recipe = defaultCarouselRecipe("poster", ["one"]);
    expect(isRecipeStale(recipe, ["one"])).toBe(false);
    expect(isRecipeStale(recipe, ["two"])).toBe(true);
    expect(recipeSourceKey(["b", "a"])).toBe("a,b");
  });

  it("nudges the same seed the same way", () => {
    const base = defaultCarouselRecipe("poster", ["ref"]);
    const first = nudgeCarouselRecipe(base, "охваты:0");
    const second = nudgeCarouselRecipe(base, "охваты:0");
    const other = nudgeCarouselRecipe(base, "охваты:1");
    expect(first).toEqual(second);
    expect(first.decorX !== other.decorX || first.decorY !== other.decorY || first.textY !== other.textY).toBe(true);
  });
});
