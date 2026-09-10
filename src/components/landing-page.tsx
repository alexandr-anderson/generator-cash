"use client";

import { ArrowRight } from "lucide-react";
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
      { title: "Экспорт", note: "ZIP: семь PNG и caption.txt" },
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
      { title: "Экспорт", note: "post.zip: PNG и caption.txt" },
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
      { title: "Экспорт", note: "reel.zip: PNG и caption.txt" },
    ],
  },
];

const KEY_STOP = 2;

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
