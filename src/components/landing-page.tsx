"use client";

import { ArrowRight, Check, Layers3, Image as ImageIcon, Video, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SUBSCRIPTION_TIERS } from "@/lib/types";
import { PublicFooter } from "@/components/public-shell";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Заготовленные примеры для первого экрана. Это не результат генерации на лету:
 * живое демо приходит отдельным этапом (docs/public-demo-plan.md), и тогда эти же
 * карточки станут местом, куда падает настоящий ответ модели. Пока показываем их
 * честно — как примеры, а не как «сгенерировано для вас».
 */
const DEMO_TOPICS = [
  {
    topic: "Почему клиенты пропадают после консультации",
    hooks: [
      { angle: "Через вопрос", text: "Клиент сказал «я подумаю» — это отказ или нет?" },
      { angle: "Через миф", text: "«Не купил — значит, было дорого». Почти никогда" },
      { angle: "Через ошибку", text: "Вы закончили консультацию словами «пишите, если что»" },
    ],
  },
  {
    topic: "Как выбрать нишу и не метаться",
    hooks: [
      { angle: "Через вопрос", text: "Что вы объясняете одно и то же третий год подряд?" },
      { angle: "Через миф", text: "«Узкая ниша — меньше клиентов». Наоборот" },
      { angle: "Через ошибку", text: "Ниша выбрана по деньгам, а не по тому, что вы видите насквозь" },
    ],
  },
  {
    topic: "Что писать, когда кажется, что всё уже сказано",
    hooks: [
      { angle: "Через вопрос", text: "Сколько раз вы удаляли пост, потому что «это все знают»?" },
      { angle: "Через миф", text: "«Об этом уже написали все». Но не вашими словами" },
      { angle: "Через ошибку", text: "Вы ищете новую тему вместо того, чтобы копнуть старую" },
    ],
  },
];

export function LandingPage() {
  const [active, setActive] = useState(0);
  const demo = DEMO_TOPICS[active];

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-container landing-nav">
          <Link href="/" className="landing-logo">
            <span className="landing-logo-icon"><Sparkles size={16} /></span>
            <b>postvmeste.ru</b>
          </Link>
          <div className="landing-nav-links">
            <a href="#formats">Форматы</a>
            <a href="#pricing">Тарифы</a>
            <ThemeToggle />
            <Link href="/auth" className="landing-cta-sm">Войти</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container hero-grid">
          <div className="hero-copy">
            <span className="landing-badge"><Sparkles size={14} /> Студия визуала для экспертов</span>
            <h1>Вы знаете,<br />что сказать.<br /><span>Осталось показать</span></h1>
            <p>
              Карусели, посты и обложки Reels в вашем стиле. Вводите тему — студия предлагает
              три захода к ней, вы правите текст и скачиваете готовые файлы.
            </p>
            <div className="hero-actions">
              <Link href="/auth?mode=register" className="btn-primary btn-lg">
                Попробовать бесплатно <ArrowRight size={18} />
              </Link>
              <span className="landing-hint">5 генераций бесплатно, карта не нужна</span>
            </div>
          </div>

          <div className="hero-demo">
            <div className="hero-demo-head">
              <strong>Три захода к одной теме</strong>
              <span>Примеры готовых крючков</span>
            </div>

            <div className="hero-demo-topics">
              {DEMO_TOPICS.map((item, index) => (
                <button
                  key={item.topic}
                  type="button"
                  className={`hero-demo-chip ${index === active ? "is-active" : ""}`}
                  onClick={() => setActive(index)}
                >
                  {item.topic}
                </button>
              ))}
            </div>

            <ul className="hero-demo-hooks">
              {demo.hooks.map((hook) => (
                <li key={hook.angle}>
                  <span className="hero-demo-angle">{hook.angle}</span>
                  <p>{hook.text}</p>
                </li>
              ))}
            </ul>

            <p className="hero-demo-foot">
              Дальше студия дописывает остальные слайды, подпись и хештеги — по выбранному заходу.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-formats" id="formats">
        <div className="landing-container">
          <h2>Три формата</h2>
          <div className="format-cards">
            <Link href="/auth?mode=register&format=carousel" className="format-card">
              <div className="format-icon" style={{ background: "var(--soft-accent)" }}>
                <Layers3 size={24} color="var(--accent)" />
              </div>
              <h3>Карусель</h3>
              <p>7 слайдов: крючок, разбор и призыв в конце. Экспертный контент, который сохраняют.</p>
              <span className="format-size">1080×1350</span>
            </Link>
            <Link href="/auth?mode=register&format=post" className="format-card">
              <div className="format-icon" style={{ background: "var(--soft-accent)" }}>
                <ImageIcon size={24} color="var(--accent)" />
              </div>
              <h3>Пост</h3>
              <p>Одна картинка, подпись и хештеги от модели. Всё, что нужно для ленты.</p>
              <span className="format-size">1080×1080</span>
            </Link>
            <Link href="/auth?mode=register&format=reel" className="format-card">
              <div className="format-icon" style={{ background: "var(--soft-accent)" }}>
                <Video size={24} color="var(--accent)" />
              </div>
              <h3>Обложка Reels</h3>
              <p>Кадр для сетки и поиска плюс подпись под ролик. Сам ролик не снимаем и не монтируем.</p>
              <span className="format-size">1080×1920</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-pricing" id="pricing">
        <div className="landing-container">
          <h2>Тарифы</h2>
          <p className="pricing-subtitle">
            Первые 5 генераций бесплатно. Оплата пока не подключена — сейчас доступен бесплатный
            доступ, платные тарифы откроются позже.
          </p>
          <div className="pricing-grid">
            {SUBSCRIPTION_TIERS.map((tier) => {
              const paid = tier.priceRub > 0;
              return (
                <div className={`pricing-card ${tier.tier === "pro" ? "pricing-popular" : ""}`} key={tier.tier}>
                  {tier.tier === "pro" && <span className="pricing-badge">Популярный</span>}
                  <h3>{tier.label}</h3>
                  <div className="pricing-price">
                    {paid ? <><b>{tier.priceRub} ₽</b><span>/ неделя</span></> : <b>0 ₽</b>}
                  </div>
                  <ul>
                    <li><Check size={14} /> {tier.description}</li>
                    <li><Check size={14} /> Все форматы</li>
                    <li><Check size={14} /> Рубрики и шаблоны</li>
                    <li><Check size={14} /> Экспорт PNG + ZIP</li>
                  </ul>
                  {paid && <span className="pricing-note">Оплата откроется позже</span>}
                  <Link
                    href="/auth?mode=register"
                    className={tier.tier === "pro" ? "btn-primary" : "btn-secondary"}
                  >
                    Попробовать бесплатно
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
