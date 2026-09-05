import type { ArchiveItem, CreativeWork, Rubric, Subscription, UserProfile } from "./types";

export const SERVICE_ACCOUNT = {
  email: "demo@postvmeste.ru",
  password: "demo1234",
} as const;

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export const DEMO_USER: UserProfile = {
  id: "demo-user",
  email: SERVICE_ACCOUNT.email,
  niche: "Маркетинг",
  audience: "Эксперты и предприниматели 25–40 лет",
  tone: "Спокойный и уверенный",
  colors: ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"],
  profileCompleted: true,
  profilePopupShown: true,
  role: "user",
};

export const DEMO_SUBSCRIPTION: Subscription = {
  tier: "pro",
  generationsPerWeek: 50,
  priceRub: 200,
  generationsUsed: 3,
  weekStartedAt: now,
  initialFreeRemaining: 0,
};

const RUBRIC_ERRORS = "demo-rubric-errors";
const RUBRIC_CASES = "demo-rubric-cases";
const RUBRIC_TRENDS = "demo-rubric-trends";

export const DEMO_RUBRICS: Rubric[] = [
  {
    id: RUBRIC_ERRORS,
    name: "Ошибки",
    colors: ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"],
    templates: {
      carousel: {
        layout: "poster",
        scenario: "Ошибка → Решение → CTA",
        decorStyle: "geometric",
        font: "Arial",
        colors: ["#f6f1e9", "#191817", "#ff5c35"],
        slideCount: 7,
      },
    },
    createdAt: now - 12 * day,
  },
  {
    id: RUBRIC_CASES,
    name: "Кейсы",
    colors: ["#3b82f6", "#93c5fd", "#eff6ff", "#1e3a5f"],
    createdAt: now - 8 * day,
  },
  {
    id: RUBRIC_TRENDS,
    name: "Тренды",
    colors: ["#8b5cf6", "#c4b5fd", "#f5f3ff", "#2e1065"],
    createdAt: now - 4 * day,
  },
];

function slide(text: string, color = "#191817", fontSize = 48) {
  return { text, fontSize, textColor: color, positionX: 50, positionY: 50 };
}

const workCarousel: CreativeWork = {
  id: "demo-work-carousel",
  format: "carousel",
  rubricId: RUBRIC_ERRORS,
  topic: "5 ошибок личного бренда",
  slides: [
    slide("5 ошибок личного бренда"),
    slide("Говорите обо всём сразу"),
    slide("Копируете чужой стиль"),
    slide("Нет постоянных рубрик"),
    slide("Публикуете без CTA"),
    slide("Одна ниша, один визуальный закон"),
    slide("Сохраните, чтобы не потерять →"),
  ],
  caption: "5 ошибок личного бренда\n\nЛистайте карусель, чтобы узнать больше 👇\n\nСохраните, чтобы не потерять 💾",
  hashtags: ["#личныйбренд", "#маркетинг", "#ошибки", "#экспертныйконтент", "#instagram"],
  layout: "poster",
  background: "#f6f1e9",
  accent: "#ff5c35",
  foreground: "#191817",
  eyebrow: "Ошибка → Решение → CTA",
  brandLabel: "demo",
  createdAt: now - 2 * day,
};

const workPost: CreativeWork = {
  id: "demo-work-post",
  format: "post",
  rubricId: RUBRIC_CASES,
  topic: "Как эксперт вырос с 800 до 12 000 подписчиков",
  slides: [slide("Как эксперт вырос с 800 до 12 000", "#1e3a5f", 42)],
  caption: "Как эксперт вырос с 800 до 12 000 подписчиков\n\nСохраните, чтобы не потерять 💾",
  hashtags: ["#кейс", "#маркетинг", "#личныйбренд", "#контент"],
  layout: "band",
  background: "#eff6ff",
  accent: "#3b82f6",
  foreground: "#1e3a5f",
  eyebrow: "Тезис",
  brandLabel: "demo",
  createdAt: now - day,
};

const workReel: CreativeWork = {
  id: "demo-work-reel",
  format: "reel",
  rubricId: RUBRIC_TRENDS,
  topic: "3 правила Reels в 2026",
  slides: [slide("3 правила Reels в 2026", "#2e1065", 64)],
  caption: "3 правила Reels в 2026\n\nСохраните, чтобы не потерять 💾",
  hashtags: ["#reels", "#тренды", "#контент", "#instagram"],
  reelScript: "Хук: Перестаньте снимать Reels «как все».\n1. Первые 2 секунды — вопрос.\n2. Один тезис на ролик.\n3. CTA в конце, не в середине.",
  layout: "centered",
  background: "#f5f3ff",
  accent: "#8b5cf6",
  foreground: "#2e1065",
  eyebrow: "Миф → Правда → CTA",
  brandLabel: "demo",
  createdAt: now - 6 * 60 * 60 * 1000,
};

export const DEMO_WORKS: CreativeWork[] = [workCarousel, workPost, workReel];

export const DEMO_ARCHIVE: ArchiveItem[] = DEMO_WORKS.map((work) => {
  const rubric = DEMO_RUBRICS.find((r) => r.id === work.rubricId);
  return {
    id: `archive-${work.id}`,
    workId: work.id,
    format: work.format,
    rubricId: work.rubricId,
    rubricName: rubric?.name || "",
    topic: work.topic,
    previewSlide: work.slides[0],
    background: work.background,
    createdAt: work.createdAt,
  };
}).sort((a, b) => b.createdAt - a.createdAt);

export function isServiceAccount(email: string, password: string) {
  return (
    email.trim().toLowerCase() === SERVICE_ACCOUNT.email &&
    password === SERVICE_ACCOUNT.password
  );
}

export function createDemoState() {
  return {
    user: { ...DEMO_USER },
    subscription: { ...DEMO_SUBSCRIPTION, weekStartedAt: Date.now() },
    rubrics: DEMO_RUBRICS.map((r) => ({ ...r })),
    archive: DEMO_ARCHIVE.map((a) => ({ ...a })),
    works: DEMO_WORKS.map((w) => ({ ...w })),
  };
}
