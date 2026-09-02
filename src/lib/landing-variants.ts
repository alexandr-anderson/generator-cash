export type LandingVariantId = "halo" | "core" | "lattice";

export type LandingLayout = "halo" | "core" | "lattice";

export type LandingVariant = {
  id: LandingVariantId;
  layout: LandingLayout;
  name: string;
  pitch: string;
  badge: string;
  headline: string;
  accent: string;
  sub: string;
  cta: string;
  secondary: string;
  hero: string;
  heroAlt: string;
};

export const LANDING_VARIANTS: LandingVariant[] = [
  {
    id: "halo",
    layout: "halo",
    name: "Halo",
    pitch: "Глобус, орбиты, стеклянные карточки вокруг ядра.",
    badge: "AI-студия для авторов",
    headline: "Соберите будущее кадра с",
    accent: "вашим стилем",
    sub: "Загрузите референсы. Студия прочитает Brand DNA и соберёт Reels, посты и карусели в этом языке.",
    cta: "Открыть студию",
    secondary: "Другие варианты",
    hero: "/landing/landing-halo-globe.png",
    heroAlt: "Тёмный глобус с коралловыми орбитами",
  },
  {
    id: "core",
    layout: "core",
    name: "Core",
    pitch: "Воздушный hero, нейронное ядро, янтарь по кромке.",
    badge: "001 / 003",
    headline: "Растите точнее с AI",
    accent: "",
    sub: "Автоматизация пакета и персональный стиль для тех, кто ведёт бренд в одиночку.",
    cta: "Начать в студии",
    secondary: "Смотреть направления",
    hero: "/landing/landing-core-neural.png",
    heroAlt: "Нейронное ядро с янтарным свечением",
  },
  {
    id: "lattice",
    layout: "lattice",
    name: "Lattice",
    pitch: "Стекло поверх ядра, холодный свет, тонкий коралл.",
    badge: "Студия без шума",
    headline: "Глубина без лишнего интерфейса",
    accent: "",
    sub: "Пять шагов от материалов до экспорта. Движение только там, где оно помогает читать слой.",
    cta: "Собрать первый пакет",
    secondary: "Другие варианты",
    hero: "/landing/landing-lattice-glass.png",
    heroAlt: "Глобус за матовыми стеклянными панелями",
  },
];

export function getLandingVariant(id: string) {
  return LANDING_VARIANTS.find((variant) => variant.id === id);
}
