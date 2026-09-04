export type ComposedScenario = {
  name: string;
  slides: string[];
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
