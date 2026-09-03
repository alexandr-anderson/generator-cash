"use client";

import { ArrowRight, Check, Layers3, Image as ImageIcon, Video, Sparkles, Zap, Download } from "lucide-react";
import Link from "next/link";
import { SUBSCRIPTION_TIERS } from "@/lib/types";

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-container landing-nav">
          <Link href="/" className="landing-logo">
            <span className="landing-logo-icon"><Sparkles size={16} /></span>
            <b>postvmeste.ru</b>
          </Link>
          <div className="landing-nav-links">
            <a href="#how">Как работает</a>
            <a href="#pricing">Тарифы</a>
            <Link href="/auth" className="landing-cta-sm">Войти / demo</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container">
          <span className="landing-badge"><Sparkles size={14} /> AI-студия для экспертов</span>
          <h1>Визуальный контент<br />для Instagram<br /><span>за минуты, не часы</span></h1>
          <p>Карусели, посты и обложки Reels в вашем стиле. Без дизайнера, без Canva, без нервов.</p>
          <div className="landing-hero-actions">
            <Link href="/auth?mode=register" className="btn-primary btn-lg">
              Попробовать бесплатно <ArrowRight size={18} />
            </Link>
            <span className="landing-hint">5 генераций бесплатно, без карты</span>
          </div>
        </div>
      </section>

      <section className="landing-formats">
        <div className="landing-container">
          <div className="format-cards">
            <Link href="/auth?mode=register&format=carousel" className="format-card">
              <div className="format-icon" style={{ background: "#fff0e8" }}><Layers3 size={28} color="#ff5c35" /></div>
              <h3>Карусель</h3>
              <p>7 слайдов с крючком, тезисами и CTA. Экспертный контент, который сохраняют.</p>
              <span className="format-size">1080×1350</span>
            </Link>
            <Link href="/auth?mode=register&format=post" className="format-card">
              <div className="format-icon" style={{ background: "#e8f0ff" }}><ImageIcon size={28} color="#3b82f6" /></div>
              <h3>Пост</h3>
              <p>Одна картинка + подпись + хештеги. Всё, что нужно для ленты.</p>
              <span className="format-size">1080×1080</span>
            </Link>
            <Link href="/auth?mode=register&format=reel" className="format-card">
              <div className="format-icon" style={{ background: "#f0e8ff" }}><Video size={28} color="#8b5cf6" /></div>
              <h3>Обложка Reels</h3>
              <p>Вертикальная обложка с заголовком + тезисы к ролику.</p>
              <span className="format-size">1080×1920</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-how" id="how">
        <div className="landing-container">
          <h2>Как это работает</h2>
          <div className="how-steps">
            <div className="how-step">
              <span className="how-number">01</span>
              <h3>Опишите тему</h3>
              <p>Выберите рубрику, введите тему и загрузите референсы. Или нажмите «помочь с текстом».</p>
            </div>
            <div className="how-step">
              <span className="how-number">02</span>
              <h3>Выберите вариант</h3>
              <p>Получите 3 направления: разные сценарии и раскладки. Выберите то, что ближе.</p>
            </div>
            <div className="how-step">
              <span className="how-number">03</span>
              <h3>Скачайте и публикуйте</h3>
              <p>Подправьте текст в редакторе, сохраните шаблон и скачайте готовые файлы.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-examples">
        <div className="landing-container">
          <h2>Примеры работ</h2>
          <div className="example-grid">
            {[
              { bg: "#1a1816", fg: "#f6f1e9", accent: "#ff5c35", title: "5 ошибок личного бренда", label: "Карусель" },
              { bg: "#f6f1e9", fg: "#1a1816", accent: "#ffc857", title: "Как выбрать нишу", label: "Пост" },
              { bg: "#2d1b4e", fg: "#f0e8ff", accent: "#8b5cf6", title: "3 правила Reels", label: "Обложка" },
              { bg: "#0f2b1e", fg: "#c6f36b", accent: "#22c55e", title: "Чек-лист запуска", label: "Карусель" },
            ].map((ex) => (
              <div className="example-card" key={ex.title} style={{ background: ex.bg, color: ex.fg }}>
                <span className="example-accent" style={{ background: ex.accent }} />
                <span className="example-label">{ex.label}</span>
                <strong>{ex.title}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-container">
          <div className="features-grid">
            {[
              { icon: <Zap size={20} />, title: "Рубрики и шаблоны", desc: "Создайте шаблон один раз — используйте для каждой новой темы." },
              { icon: <Sparkles size={20} />, title: "Генерация текста", desc: "AI напишет текст по вашей теме, нише и тону голоса." },
              { icon: <Download size={20} />, title: "Экспорт одним кликом", desc: "PNG-файлы + подпись с хештегами. ZIP для каруселей." },
            ].map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-pricing" id="pricing">
        <div className="landing-container">
          <h2>Тарифы</h2>
          <p className="pricing-subtitle">Первые 5 генераций бесплатно. Потом — 1 в неделю или подписка.</p>
          <div className="pricing-grid">
            {SUBSCRIPTION_TIERS.map((tier) => (
              <div className={`pricing-card ${tier.tier === "pro" ? "pricing-popular" : ""}`} key={tier.tier}>
                {tier.tier === "pro" && <span className="pricing-badge">Популярный</span>}
                <h3>{tier.label}</h3>
                <div className="pricing-price">
                  {tier.priceRub > 0 ? <><b>{tier.priceRub} ₽</b><span>/ неделя</span></> : <b>0 ₽</b>}
                </div>
                <p>{tier.description}</p>
                <ul>
                  <li><Check size={14} /> {tier.generationsPerWeek} генераций в неделю</li>
                  <li><Check size={14} /> Все форматы</li>
                  <li><Check size={14} /> Рубрики и шаблоны</li>
                  <li><Check size={14} /> Экспорт PNG + ZIP</li>
                </ul>
                <Link href="/auth?mode=register" className={tier.tier === "pro" ? "btn-primary" : "btn-secondary"}>
                  Начать
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container">
          <span>postvmeste.ru · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
