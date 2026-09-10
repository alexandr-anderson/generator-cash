"use client";

import { ArrowRight, ImagePlus, Layers3, Palette, Tag } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SUBSCRIPTION_TIERS } from "@/lib/types";
import { PublicFooter } from "@/components/public-shell";
import { ThemeToggle } from "@/components/theme-toggle";

type Stop = { title: string; note: string };
type Format = { id: string; name: string; size: string; sky: 1 | 2 | 3; stops: Stop[] };

/**
 * Путь клиента по форматам. Шаги взяты из того, что продукт реально делает:
 * заходы — из SCENARIO_SPECS / POST_SCENARIO_SPECS / REEL_SCENARIO_SPECS,
 * состав пакетов — из экспорта. Третий шаг всюду ключевой: там появляется картинка.
 */
const FORMATS: Format[] = [
  {
    id: "carousel",
    name: "Карусель",
    size: "1080×1350",
    sky: 1,
    stops: [
      { title: "Тема", note: "Строка от вас и до четырёх референсов" },
      { title: "Три захода", note: "Через вопрос, миф или ошибку" },
      { title: "Семь слайдов", note: "Дописываются под выбранный заход" },
      { title: "Редактор", note: "Кегль и цвета вашего бренда" },
      { title: "Экспорт", note: "Скачать архивом или на телефон" },
    ],
  },
  {
    id: "post",
    name: "Пост",
    size: "1080×1080",
    sky: 2,
    stops: [
      { title: "Тема и текст", note: "Ваш текст остаётся вашим" },
      { title: "Три подачи", note: "Тезис, вопрос или совет" },
      { title: "Картинка", note: "1080×1080 — рисует модель" },
      { title: "Подпись", note: "Ваш текст плюс 10–15 хештегов" },
      { title: "Экспорт", note: "Скачать пакетом" },
    ],
  },
  {
    id: "reel",
    name: "Обложка Reels",
    size: "1080×1920",
    sky: 3,
    stops: [
      { title: "Тема", note: "Строка, подпись или транскрипт" },
      { title: "Три хука", note: "Провокация, дыра или обещание" },
      { title: "Обложка", note: "1080×1920 — рисует модель" },
      { title: "Подпись", note: "Пишется по выбранному хуку" },
      { title: "Экспорт", note: "Скачать пакетом" },
    ],
  },
];

const KEY_STOP = 2;

type RubricStep = { icon: typeof Tag; title: string; example: string; note: string };

/**
 * Как на самом деле устроена настройка рубрики в create-flow.tsx:
 * название → цвета (по умолчанию из профиля, store.updateRubric) → референс
 * (uploadReference, снимает композицию через carouselRecipe) → шаблон
 * (saveTemplate, отдельный на формат). Пример — сквозной, одна ниша (нутрициолог).
 */
const RUBRIC_STEPS: RubricStep[] = [
  {
    icon: Tag,
    title: "Название",
    example: "«Мифы о похудении»",
    note: "Рубрика — как папка в контент-плане: под одной темой собираются все карусели, посты и обложки.",
  },
  {
    icon: Palette,
    title: "Цвета",
    example: "3–4 цвета из профиля",
    note: "Стартуют из общего бренда, но для рубрики их можно подвинуть. Дальше они ложатся на каждый слайд, пост и обложку внутри неё.",
  },
  {
    icon: ImagePlus,
    title: "Референс",
    example: "до 4 картинок, по желанию",
    note: "Пример композиции — свой старый пост или чужой, который нравится. Модель снимает раскладку, цвета всё равно берёт ваши.",
  },
  {
    icon: Layers3,
    title: "Шаблон",
    example: "«Сохранить как шаблон для рубрики»",
    note: "Понравившийся результат закрепляете за рубрикой — отдельно для карусели, поста и обложки. Дальше рубрика стартует не с нуля, а с него.",
  },
];

const PROMISES = [
  { title: "В ваших цветах", note: "Не в наших — палитра берётся из профиля" },
  { title: "Текст правите вы", note: "Модель предлагает, последнее слово ваше" },
  { title: "Файлы сразу у вас", note: "PNG и подпись в ZIP, без привязки к сервису" },
  { title: "Роликов не снимаем", note: "Только обложка и текст под неё" },
];

/**
 * Показываем секцию, когда она доехала до экрана. Без библиотек.
 * Возвращаем кортежем, чтобы ref уходил прямо в атрибут и не читался в рендере.
 */
function useReveal<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return [ref, shown];
}

export function LandingPage() {
  const [active, setActive] = useState(0);
  const format = FORMATS[active];
  const [flowRef, flowShown] = useReveal<HTMLElement>();
  const [pricingRef, pricingShown] = useReveal<HTMLElement>();

  return (
    <div className="landing">
      <div className={`landing-sky sky-${format.sky}`} aria-hidden />

      <header className="landing-header">
        <div className="landing-container landing-nav glass">
          <Link href="/" className="landing-logo"><b>postvmeste</b></Link>
          <div className="landing-nav-links">
            <a href="#flow">Как это устроено</a>
            <a href="#pricing">Цены</a>
            <ThemeToggle />
            <Link href="/auth" className="landing-cta-sm">Войти</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container">
          <span className="landing-badge glass"><i /> Для экспертов, которые ведут блог сами</span>
          <h1>Единый визуальный код<br /><b>вашего блога</b></h1>
          <p className="hero-sub">
            AI-инструменты, которые упаковывают вашу экспертизу. Сохраните свой стиль, пока нейросети
            делают рутину.
          </p>
          <div className="hero-actions">
            <Link href="/auth?mode=register" className="btn-primary btn-lg">
              Собрать первый пост <ArrowRight size={18} />
            </Link>
            <a href="#flow" className="btn-ghost glass">Сначала посмотреть, как это работает ↓</a>
          </div>
          <span className="landing-hint">Пять генераций бесплатно. Карта не нужна.</span>
        </div>
      </section>

      <section className={`landing-flow ${flowShown ? "is-shown" : ""}`} id="flow" ref={flowRef}>
        <div className="landing-container">
          <div className="rubric-intro">
            <span className="rubric-kicker">Прежде всего</span>
            <h2 className="sec-title">Всё держится на <b>рубриках</b></h2>
            <p className="sec-sub">
              Рубрика — серия контента с одним закреплённым стилем. Внутри неё карусель, пост и обложка
              Reels выходят в одном визуальном коде. У нутрициолога, например, может быть рубрика
              «Мифы о похудении», «Разбор меню» и «Личный дневник» — у каждой свой стиль, и подгонять
              новый контент под него каждый раз не нужно.
            </p>
            <ol className="rubric-steps">
              {RUBRIC_STEPS.map((s, index) => (
                <li className="rubric-step glass" key={s.title}>
                  <span className="rubric-step-top">
                    <span className="rubric-step-num">{`0${index + 1}`}</span>
                    <s.icon size={16} />
                  </span>
                  <h3>{s.title}</h3>
                  <span className="rubric-step-example">{s.example}</span>
                  <p>{s.note}</p>
                </li>
              ))}
            </ol>
            <p className="rubric-outro">
              Один раз настроили рубрику — дальше от вас только тема. Вот что можно собрать внутри неё:
            </p>
          </div>

          <h2 className="sec-title">С чего <b>начнём?</b></h2>
          <p className="sec-sub">
            Наведите на формат — покажем весь путь до готового файла. Ничего не прячем: на любом шаге
            можно остановиться и поправить.
          </p>

          <div className="flow-tabs" role="tablist" aria-label="Формат">
            {FORMATS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === active}
                className={`flow-tab glass ${index === active ? "is-active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
              >
                <span className="flow-tab-name">{item.name}</span>
                <span className="flow-tab-size">{item.size}</span>
              </button>
            ))}
          </div>

          <svg className="flow-path" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="flow-gradient" x1="0" x2="1">
                <stop offset="0" stopColor="var(--accent)" />
                <stop offset="1" stopColor="var(--spark)" />
              </linearGradient>
            </defs>
            {/* key по формату: перемонтируем путь, чтобы линия рисовалась заново */}
            <path
              key={format.id}
              className="flow-path-line"
              d="M40,150 C160,150 180,60 300,60 C420,60 430,140 550,140 C670,140 690,50 810,50 C900,50 930,80 960,90"
            />
          </svg>

          <ol className="flow-stops" key={format.id}>
            {format.stops.map((stop, index) => (
              <li key={stop.title} className={`flow-stop ${index === KEY_STOP ? "is-key" : ""}`}>
                <span className="flow-dot glass">{`0${index + 1}`}</span>
                <h3>{stop.title}</h3>
                <p>{stop.note}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-promises">
        <div className="landing-container">
          <div className="promises glass">
            {PROMISES.map((item) => (
              <div key={item.title}>
                <b>{item.title}</b>
                {item.note}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className={`landing-pricing ${pricingShown ? "is-shown" : ""}`}
        id="pricing"
        ref={pricingRef}
      >
        <div className="landing-container">
          <h2 className="sec-title">Сколько это <b>стоит</b></h2>
          <p className="sec-sub">
            Начните с пяти бесплатных — этого хватит, чтобы понять, ваше это или нет. Оплата пока не
            подключена, платные тарифы откроются позже.
          </p>
          <div className="pricing-grid">
            {SUBSCRIPTION_TIERS.map((tier) => (
              <div className={`pricing-card glass ${tier.tier === "pro" ? "is-hot" : ""}`} key={tier.tier}>
                <span className="pricing-name">{tier.label}</span>
                <span className="pricing-amount">
                  {tier.priceRub > 0 ? <>{tier.priceRub} <i>₽/нед</i></> : <>0 <i>₽</i></>}
                </span>
                <span className="pricing-gen">{tier.description}</span>
                <span className="pricing-state">
                  {tier.priceRub > 0 ? "Откроется позже" : "Доступно сейчас"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-final">
        <div className="landing-container">
          <div className="final-card glass">
            <h2>Тема, которую вы <b>откладываете</b> третью неделю</h2>
            <p>Начните с неё. Пять генераций бесплатно — карта не нужна, отписываться не от чего.</p>
            <Link href="/auth?mode=register" className="btn-primary btn-lg">
              Собрать первый пост <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
