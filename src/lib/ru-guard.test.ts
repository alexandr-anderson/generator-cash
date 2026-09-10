import { describe, expect, it } from "vitest";
import { inspectRussian } from "./ru-guard";

// Тексты ниже — не выдумка: это реальные ответы модели с прода 2026-09-10,
// до и после смены OPENAI_MODEL с gpt-5.5 на chatgpt-5.6. См. п. 46 в docs/work-plan.md.
const BROKEN_SLIDES = [
  "Вы чувствуете усталость после days...",
  "第一季：每周3次以上可改善",
  "第二季：每天持续10个以上有效",
  "后果：逐渐丧失激发能力",
];
const BROKEN_HASHTAGS = ["#脑科学图解", "#心理热量", "#休息神经", "#能量萧条"];
const GOOD_SLIDES = [
  "Постоянная усталость без отдыха? — Признак выгорания.",
  "Депрессия без явной причины? — Признак выгорания",
  "Выгорание начинается с крошечных сигналов. Пренебрегайте ими — и они становятся криком",
  "Сохраните этот слайд. Или напишите, как вы справляетесь с выгоранием",
];

describe("inspectRussian", () => {
  it("отклоняет китайские слайды с прода", () => {
    const verdict = inspectRussian(BROKEN_SLIDES);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("чужая письменность");
  });

  it("отклоняет китайские хештеги с прода", () => {
    expect(inspectRussian(BROKEN_HASHTAGS).ok).toBe(false);
  });

  it("пропускает исправленную русскую карусель", () => {
    const verdict = inspectRussian(GOOD_SLIDES);
    expect(verdict.ok).toBe(true);
    expect(verdict.strayLatin).toEqual([]);
  });

  it("пропускает одиночное английское слово, но помечает его", () => {
    const verdict = inspectRussian("Миф: усталость неизбежна. Реальность: это сигнал crisis.");
    expect(verdict.ok).toBe(true);
    expect(verdict.strayLatin).toEqual(["crisis"]);
  });

  it("не считает брендом-исключением помеченную латиницу", () => {
    const verdict = inspectRussian("Как вести Instagram и Reels в 2026 году");
    expect(verdict.ok).toBe(true);
    expect(verdict.strayLatin).toEqual([]);
  });

  it("отклоняет ответ, где кириллица потеряла большинство", () => {
    const verdict = inspectRussian("Burnout is a serious problem — выгорание");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("кириллицы");
  });

  it("не спотыкается о пустой ответ — на это есть отдельные проверки", () => {
    expect(inspectRussian("").ok).toBe(true);
    expect(inspectRussian([]).ok).toBe(true);
  });

  it("не считает цифры и пунктуацию поводом для тревоги", () => {
    expect(inspectRussian("2026 — 10 из 15. 100%").ok).toBe(true);
  });
});
