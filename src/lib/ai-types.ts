import type { CreativeFormat } from "./types";

export type ComposedScenario = {
  name: string;
  slides: string[];
  caption?: string;
  imageUrl?: string;
};

export type ComposedCopy = {
  text: string;
  caption: string;
  hashtags: string[];
  reelScript?: string;
  scenarios: ComposedScenario[];
};

export const SCENARIO_SPECS = [
  {
    name: "Крючок → Разбор → CTA",
    hint: "1 — крючок-вопрос, 2–5 — разбор по пунктам, 6 — усиление, 7 — призыв сохранить/написать",
  },
  {
    name: "Миф → Правда → CTA",
    hint: "1 — миф, 2–5 — почему это не так и как на самом деле, 6 — вывод, 7 — CTA",
  },
  {
    name: "Ошибка → Решение → CTA",
    hint: "1 — типичная ошибка, 2–5 — что делать вместо этого, 6 — быстрый план, 7 — CTA",
  },
] as const;

export const POST_SCENARIO_SPECS = [
  {
    name: "Тезис",
    hint: "Визуальная метафора готового вывода: спокойный, уверенный кадр без людей с плакатами.",
  },
  {
    name: "Вопрос",
    hint: "Визуальная метафора напряжения или пустого места, которое просит ответа.",
  },
  {
    name: "Совет",
    hint: "Визуальная метафора инструмента, жеста или следующего шага.",
  },
] as const;

export function scenarioSpecsFor(format: CreativeFormat) {
  if (format === "post") return POST_SCENARIO_SPECS;
  return SCENARIO_SPECS;
}
