export type LandingVariantId = "signal" | "orbit" | "grain" | "prism";

export type LandingVariant = {
  id: LandingVariantId;
  name: string;
  pitch: string;
  headline: string;
  sub: string;
  cta: string;
  hero: string;
  heroAlt: string;
};

export const LANDING_VARIANTS: LandingVariant[] = [
  {
    id: "signal",
    name: "Signal",
    pitch: "Тёмное поле, коралловый импульс, сетка нитей.",
    headline: "Сначала ваш стиль. Потом кадр.",
    sub: "Загрузите референсы. Студия соберёт Brand DNA и соберёт Reels, посты и карусели в этом языке.",
    cta: "Открыть студию",
    hero: "/landing/landing-signal-hero.png",
    heroAlt: "Тёмное нейронное поле с коралловым светом",
  },
  {
    id: "orbit",
    name: "Orbit",
    pitch: "Форматы кружат в пространстве, лайм по кромке.",
    headline: "Три формата. Одна ДНК.",
    sub: "Reels, пост 4:5 и карусель собираются из одного утверждённого профиля, а не из шаблона.",
    cta: "Собрать первый пакет",
    hero: "/landing/landing-orbit-hero.png",
    heroAlt: "Три контент-фрейма в тёмном пространстве",
  },
  {
    id: "grain",
    name: "Grain",
    pitch: "Киношное зерно, стол референсов, тёплый свет.",
    headline: "Как будто кадр уже был вашим.",
    sub: "Палитра и голос читаются с ваших картинок. Генерация не подменяет их чужим глянцем.",
    cta: "Загрузить референсы",
    hero: "/landing/landing-grain-hero.png",
    heroAlt: "Стол с печатными референсами в тёплом киношном свете",
  },
  {
    id: "prism",
    name: "Prism",
    pitch: "Стеклянные слои, тихий объём, холодный свет.",
    headline: "Студия без шума интерфейса.",
    sub: "Пять шагов от материалов до экспорта. Движение только там, где оно помогает читать глубину.",
    cta: "Начать в студии",
    hero: "/landing/landing-prism-hero.png",
    heroAlt: "Слои матового стекла в тёмной студии",
  },
];

export function getLandingVariant(id: string) {
  return LANDING_VARIANTS.find((variant) => variant.id === id);
}
