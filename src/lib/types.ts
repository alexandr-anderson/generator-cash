import type { CarouselRecipe } from "./carousel-recipe";

export type { CarouselRecipe } from "./carousel-recipe";

export type CreativeFormat = "carousel" | "post" | "reel";

export type CreativeLayout = "poster" | "band" | "centered";

export type NicheOption = {
  id: string;
  label: string;
  suggestedRubrics: string[];
};

export type UserRole = "user" | "admin";

export type UserProfile = {
  id: string;
  email: string;
  niche: string;
  audience?: string;
  tone?: string;
  colors?: string[];
  logoUrl?: string;
  profileCompleted: boolean;
  profilePopupShown: boolean;
  role: UserRole;
};

export type AdminUserFilter = "all" | "paid" | "free" | "banned";

export type AdminUserPatch = {
  initialFreeRemaining?: number;
  tier?: Subscription["tier"];
  banned?: boolean;
};

export type AdminUserRow = {
  id: string;
  email: string;
  niche: string;
  role: UserRole;
  emailVerifiedAt: number | null;
  createdAt: number;
  bannedAt: number | null;
  subscription: Subscription;
  remaining: number;
  weeklyRemaining: number;
};

export type Subscription = {
  tier: "free" | "starter" | "pro" | "business";
  generationsPerWeek: number;
  priceRub: number;
  generationsUsed: number;
  weekStartedAt: number;
  initialFreeRemaining: number;
};

export type Rubric = {
  id: string;
  name: string;
  references?: string[];
  inspirationUrl?: string;
  colors?: string[];
  carouselRecipe?: CarouselRecipe | null;
  templates?: Partial<Record<CreativeFormat, Template>>;
  createdAt: number;
};

export type Template = {
  layout: CreativeLayout;
  scenario: string;
  decorStyle: string;
  font: string;
  colors: string[];
  slideCount: number;
};

export type SlideContent = {
  text: string;
  fontSize: number;
  textColor: string;
  positionX: number;
  positionY: number;
  imageUrl?: string;
};

export type CreativeWork = {
  id: string;
  format: CreativeFormat;
  rubricId: string | null;
  topic: string;
  slides: SlideContent[];
  caption: string;
  hashtags: string[];
  reelScript?: string;
  layout: CreativeLayout;
  background: string;
  accent: string;
  foreground: string;
  eyebrow: string;
  brandLabel: string;
  recipe?: CarouselRecipe;
  createdAt: number;
};

export type ArchiveItem = {
  id: string;
  workId: string;
  format: CreativeFormat;
  rubricId: string | null;
  rubricName: string;
  topic: string;
  previewSlide: SlideContent;
  background: string;
  createdAt: number;
};

export type CreateFlowState = {
  step: "format" | "rubric" | "topic" | "references" | "text" | "generate" | "variants" | "editor" | "save";
  format: CreativeFormat | null;
  rubricId: string | null;
  topic: string;
  references: string[];
  colors: string[];
  userText: string;
  generatedText: string;
  variants: CreativeWork[];
  selectedVariantId: string | null;
  work: CreativeWork | null;
};

export const NICHES: NicheOption[] = [
  { id: "psychology", label: "Психология", suggestedRubrics: ["Разборы", "Мифы", "Упражнения", "Кейсы"] },
  { id: "marketing", label: "Маркетинг", suggestedRubrics: ["Ошибки", "Кейсы", "Инструменты", "Тренды"] },
  { id: "fitness", label: "Фитнес и здоровье", suggestedRubrics: ["Тренировки", "Питание", "Мифы", "Мотивация"] },
  { id: "business", label: "Бизнес и предпринимательство", suggestedRubrics: ["Кейсы", "Ошибки", "Инструменты", "Финансы"] },
  { id: "education", label: "Образование", suggestedRubrics: ["Лайфхаки", "Разборы", "Методики", "Мотивация"] },
  { id: "beauty", label: "Красота и уход", suggestedRubrics: ["Уход", "Тренды", "Разборы средств", "До/После"] },
  { id: "design", label: "Дизайн", suggestedRubrics: ["Разборы", "Тренды", "До/После", "Инструменты"] },
  { id: "finance", label: "Финансы", suggestedRubrics: ["Ошибки", "Советы", "Разборы", "Кейсы"] },
  { id: "cooking", label: "Кулинария", suggestedRubrics: ["Рецепты", "Лайфхаки", "Разборы", "Подборки"] },
  { id: "parenting", label: "Родительство", suggestedRubrics: ["Советы", "Ошибки", "Разборы", "Истории"] },
];

export const TONES = [
  "Спокойный и уверенный",
  "Тёплый и дружелюбный",
  "Смелый и провокационный",
  "Строгий и экспертный",
];

export const SUBSCRIPTION_TIERS = [
  { tier: "free" as const, label: "Бесплатно", generationsPerWeek: 1, priceRub: 0, description: "1 генерация в неделю" },
  { tier: "starter" as const, label: "Старт", generationsPerWeek: 10, priceRub: 50, description: "10 генераций в неделю" },
  { tier: "pro" as const, label: "Про", generationsPerWeek: 50, priceRub: 200, description: "50 генераций в неделю" },
  { tier: "business" as const, label: "Бизнес", generationsPerWeek: 100, priceRub: 500, description: "100 генераций в неделю" },
];

export const FORMAT_LABELS: Record<CreativeFormat, string> = {
  carousel: "Карусель",
  post: "Пост",
  reel: "Обложка Reels",
};

export const FORMAT_SIZES: Record<CreativeFormat, { width: number; height: number; label: string }> = {
  carousel: { width: 1080, height: 1350, label: "1080×1350" },
  post: { width: 1080, height: 1080, label: "1080×1080" },
  reel: { width: 1080, height: 1920, label: "1080×1920" },
};
