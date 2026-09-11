"use client";

import { ArrowRight, ImagePlus, Palette, Tag } from "lucide-react";
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
      { title: "Три захода", note: "Через вопрос, миф или ошибку. Ждать 2–3 минуты" },
      { title: "Семь слайдов", note: "Дописываются под выбранный заход. Текст без фото, ещё 2–3 минуты" },
      { title: "Редактор", note: "Текст, размер шрифта и ваши цвета" },
      { title: "Экспорт", note: "Архивом или по одному файлу в галерею телефона" },
    ],
  },
  {
    id: "post",
    name: "Пост",
    size: "1080×1080",
    sky: 2,
    stops: [
      { title: "Тема и текст", note: "Оба поля обязательны. Ваш текст остаётся вашим" },
      { title: "Три подачи", note: "Тезис, вопрос или совет" },
      { title: "Картинка", note: "1080×1080 — рисует модель, 2–3 минуты" },
      { title: "Подпись", note: "Ваш текст плюс 10–15 хештегов" },
      { title: "Экспорт", note: "Архивом: PNG и подпись" },
    ],
  },
  {
    id: "reel",
    name: "Обложка Reels",
    size: "1080×1920",
    sky: 3,
    stops: [
      { title: "Тема", note: "Обязательна только она. Подпись или транскрипт — по желанию" },
      { title: "Три хука", note: "Провокация, недосказанность или обещание" },
      { title: "Обложка", note: "1080×1920 — рисует модель, 2–3 минуты" },
      { title: "Подпись", note: "Ваш текст остаётся как есть, пустое поле напишем сами" },
      { title: "Экспорт", note: "Архивом: PNG и подпись" },
    ],
  },
];

const KEY_STOP = 2;

type RubricStep = { icon: typeof Tag; title: string; example: string; note: string };

/**
 * Как на самом деле устроена настройка рубрики в create-flow.tsx:
 * название → цвета (по умолчанию из профиля, store.updateRubric) → референс
 * (uploadReference, снимает композицию через carouselRecipe). Пример — сквозной,
 * одна ниша (нутрициолог).
 *
 * Четвёртого шага, «Шаблон», здесь намеренно нет. Галочка «Сохранить как шаблон
 * для рубрики» пишет запись в базу (saveTemplate), но при сборке её никто не
 * читает: раскладку даёт carouselRecipe из референса, цвета — рубрика и профиль.
 * Обещать на лендинге, что рубрика «стартует с него», значило бы продавать то,
 * чего продукт не делает. Вернуть шаг, когда шаблон начнёт влиять на генерацию.
 */
const RUBRIC_STEPS: RubricStep[] = [
  {
    icon: Tag,
    title: "Название",
    example: "«Мифы о похудении»",
    note: "Одна строка о том, про что эта серия. По названию вы потом найдёте рубрику в списке и выберете её перед сборкой.",
  },
  {
    icon: Palette,
    title: "Цвета",
    example: "цвета из профиля",
    note: "Стартуют из общего бренда, но для рубрики их можно подвинуть. Дальше они ложатся на каждый слайд, пост и обложку внутри неё.",
  },
  {
    icon: ImagePlus,
    title: "Референс",
    example: "до 4 картинок, по желанию",
    note: "Пример композиции — свой старый пост или чужой, который нравится. Модель снимает раскладку, цвета всё равно берёт ваши.",
  },
];

const PROMISES = [
  { title: "В ваших цветах", note: "Не в наших — палитра берётся из профиля" },
  { title: "Текст правите вы", note: "Модель предлагает, последнее слово ваше" },
  { title: "Файлы сразу у вас", note: "Архив с PNG и подписью, без привязки к сервису" },
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
          <Link href="/" className="landing-logo"><b>postvmeste.ru</b></Link>
          <div className="landing-nav-links">
            <a href="#flow">Как это устроено</a>
            <a href="#pricing">Цены</a>
            <ThemeToggle />
            <Link href="/auth">Войти</Link>
            <Link href="/auth?mode=register" className="landing-cta-sm">Попробовать</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container">
          <span className="landing-badge glass"><i /> Для экспертов, которые ведут блог сами</span>
          <h1>Единый визуальный код<br /><b>вашего блога</b></h1>
          <p className="hero-sub">
            Карусели, посты и обложки Reels для Instagram. Вы приносите тему — визуал и текст
            собирает модель, в цветах вашего бренда.
          </p>
          <div className="hero-actions">
            <Link href="/auth?mode=register" className="btn-primary btn-lg">
              Собрать первую публикацию <ArrowRight size={18} />
            </Link>
            <a href="#flow" className="btn-ghost glass">Посмотреть, как это устроено ↓</a>
          </div>
          <span className="landing-hint">Пять генераций бесплатно. Нужна только почта — карта не нужна.</span>
        </div>
      </section>

      <section className={`landing-flow ${flowShown ? "is-shown" : ""}`} id="flow" ref={flowRef}>
        <div className="landing-container">
          <div className="rubric-intro">
            <span className="rubric-kicker">Прежде всего</span>
            <h2 className="sec-title">Всё держится на <b>рубриках</b></h2>
            <p className="sec-sub">
              Рубрика — серия публикаций с одним закреплённым стилем. Внутри неё карусель, пост и
              обложка Reels выходят в одном визуальном коде. У нутрициолога, например, могут быть
              рубрики «Мифы о похудении», «Разбор меню» и «Личный дневник» — у каждой свой стиль, и
              подгонять новую работу под него каждый раз не нужно. Отдельного экрана настройки нет:
              рубрика собирается по ходу первой работы.
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
              Один раз настроили рубрику — дальше от вас тема и выбор одного варианта из трёх.
              Вот что можно собрать внутри неё:
            </p>
          </div>

          <h2 className="sec-title">С чего <b>начнём?</b></h2>
          <p className="sec-sub">
            Выберите формат — покажем весь путь до готового файла. Ничего не прячем: на любом шаге
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
            Одна генерация — один готовый материал: карусель, пост или обложка Reels. Первые пять
            бесплатно, этого хватит, чтобы понять, ваше это или нет. Дальше на бесплатном тарифе
            остаётся одна в неделю. Оплата пока не подключена, платные тарифы откроются позже.
          </p>
          <div className="pricing-grid">
            {SUBSCRIPTION_TIERS.map((tier) => (
              /* Пока касса закрыта, акцент стоит на бесплатном: выделять рамкой «Про»,
                 который нельзя купить ни одним способом, — витрина недоступного.
                 Когда ЮKassa подключится, вернуть сюда "pro". */
              <div className={`pricing-card glass ${tier.tier === "free" ? "is-hot" : ""}`} key={tier.tier}>
                <span className="pricing-name">{tier.label}</span>
                <span className="pricing-amount">
                  {tier.priceRub > 0 ? <>{tier.priceRub} <i>₽/нед</i></> : <>0 <i>₽</i></>}
                </span>
                {/* На лендинге человек ещё не потратил стартовые пять, и «1 генерация в неделю»
                    из общего словаря читается как подмена обещания из шапки. В профиле и
                    админке та же строка верна, поэтому подменяем только здесь. */}
                <span className="pricing-gen">
                  {tier.tier === "free" ? "5 генераций сразу, дальше 1 в неделю" : tier.description}
                </span>
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
            <p>Начните с неё. Пять генераций бесплатно, карта не нужна.</p>
            <Link href="/auth?mode=register" className="btn-primary btn-lg">
              Собрать первую публикацию <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
