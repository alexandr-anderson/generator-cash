import Image from "next/image";
import Link from "next/link";
import { LANDING_VARIANTS, type LandingVariant } from "@/lib/landing-variants";
import { ParallaxRoot } from "./parallax-root";

const steps = [
  {
    title: "Материалы",
    body: "До 20 своих PNG, JPEG или WEBP. Файлы остаются в браузере.",
  },
  {
    title: "Brand DNA",
    body: "Палитра, голос, плотность и композиция читаются с референсов.",
  },
  {
    title: "Бриф",
    body: "Тема, аудитория, цель. Стиль уже зафиксирован.",
  },
  {
    title: "Пакет",
    body: "Обложка Reels, пост 4:5 и карусель в одной ДНК.",
  },
];

export function LandingPage({ variant }: { variant: LandingVariant }) {
  return (
    <ParallaxRoot className="lp-page" variant={variant.id}>
      <header className="lp-nav">
        <Link className="lp-mark" href="/landing">
          postvmeste
        </Link>
        <nav aria-label="Варианты лендинга">
          {LANDING_VARIANTS.map((item) => (
            <Link
              key={item.id}
              href={`/landing/${item.id}`}
              aria-current={item.id === variant.id ? "page" : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <Link className="lp-nav-cta" href="/">
          Студия
        </Link>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>{variant.headline}</h1>
          <p>{variant.sub}</p>
          <div className="lp-hero-actions">
            <Link className="lp-btn-primary" href="/">
              {variant.cta}
            </Link>
            <Link className="lp-btn-ghost" href="/landing">
              Другие варианты
            </Link>
          </div>
        </div>
        <div className="lp-hero-stage" aria-hidden="true">
          <div className="lp-hero-glow" />
          <div className="lp-hero-orbit">
            <span className="lp-hero-orbit-ring" />
          </div>
          <div className="lp-hero-media">
            <Image
              src={variant.hero}
              alt={variant.heroAlt}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 58vw"
            />
          </div>
        </div>
      </section>

      <section className="lp-split">
        <div className="lp-photo">
          <Image
            src="/landing/landing-dna-table.png"
            alt="Печатные референсы на столе"
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </div>
        <div className="lp-split-copy">
          <h2>ДНК собирается с ваших картинок</h2>
          <p>
            Не с палитры продукта. Цвет, тепло, контраст и пропорции кадра
            становятся профилем. Вы правите формулировки и только потом
            запускаете генерацию.
          </p>
        </div>
      </section>

      <section className="lp-flow">
        <h2>От файла до пакета</h2>
        <div className="lp-flow-grid">
          {steps.map((step) => (
            <article key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-formats">
        <div className="lp-formats-copy">
          <h2>Reels, пост, карусель</h2>
          <p>
            Один утверждённый профиль держит три формата. Макет и плотность
            текста меняются вместе с ДНК, а не копируются из одной заготовки.
          </p>
          <Link className="lp-btn-primary" href="/">
            {variant.cta}
          </Link>
        </div>
        <div className="lp-photo lp-photo-tall">
          <Image
            src="/landing/landing-formats-still.png"
            alt="Три формата контента на студийном столе"
            fill
            sizes="(max-width: 900px) 100vw, 46vw"
          />
        </div>
      </section>

      <footer className="lp-foot">
        <p>postvmeste / {variant.name}</p>
        <Link href="/">Открыть студию</Link>
      </footer>
    </ParallaxRoot>
  );
}
