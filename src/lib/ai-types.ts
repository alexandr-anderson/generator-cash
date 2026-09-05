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
    label: "Через вопрос",
    hint: "1 — вопрос, 2 — чем одно отличается от другого, 3 — как это работает, 4 — пример или типичная ошибка, 5 — что будет, если не менять, 6 — правило, 7 — сохранить или написать один ответ",
  },
  {
    name: "Миф → Правда → CTA",
    label: "Через миф",
    hint: "1 — миф, 2 — почему так думают, 3 — как на самом деле, 4 — пример, 5 — цена ошибки, 6 — правило, 7 — сохранить или написать один ответ",
  },
  {
    name: "Ошибка → Решение → CTA",
    label: "Через ошибку",
    hint: "1 — типичная ошибка, 2 — почему так делают, 3 — что делать вместо этого, 4 — пример, 5 — что меняется, 6 — правило, 7 — сохранить или написать один ответ",
  },
] as const;

export function scenarioLabel(name: string) {
  return SCENARIO_SPECS.find((item) => item.name === name)?.label || name;
}

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

export const REEL_SCENARIO_SPECS = [
  {
    name: "Провокация",
    hint: "Визуальная метафора сломанной привычки или резкой остановки: напряжение, без табличек и жестов «стоп».",
  },
  {
    name: "Дыра",
    hint: "Визуальная метафора пустого места или нехватки: кадр просит ответа, без вопросительных знаков на картинке.",
  },
  {
    name: "Обещание",
    hint: "Визуальная метафора одного ясного следующего шага или инструмента. Спокойный, конкретный кадр.",
  },
] as const;

export function scenarioSpecsFor(format: CreativeFormat) {
  if (format === "post") return POST_SCENARIO_SPECS;
  if (format === "reel") return REEL_SCENARIO_SPECS;
  return SCENARIO_SPECS;
}
