import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Images,
  LayoutPanelTop,
  ScanSearch,
} from "lucide-react";
import { LANDING_VARIANTS, type LandingVariant } from "@/lib/landing-variants";
import { ParallaxRoot } from "./parallax-root";

const features = [
  {
    title: "Материалы",
    body: "До 20 своих PNG, JPEG или WEBP. Файлы остаются в браузере.",
    Icon: Images,
  },
  {
    title: "Brand DNA",
    body: "Палитра, голос, плотность и композиция читаются с референсов.",
    Icon: ScanSearch,
  },
  {
    title: "Форматы",
    body: "Reels, пост 4:5 и карусель держатся одной ДНК, а не шаблоном.",
    Icon: LayoutPanelTop,
  },
  {
    title: "Пакет",
    body: "Экспорт без чужого глянца. Стиль уже зафиксирован в профиле.",
    Icon: Download,
  },
];

const facts = [
  { value: "20", label: "референсов локально" },
  { value: "3", label: "формата в одной ДНК" },
  { value: "5", label: "шагов до экспорта" },
];

function LandingNav({ variant }: { variant: LandingVariant }) {
  return (
    <header className="lp-nav">
      <Link className="lp-mark" href="/landing">
        <span className="lp-mark-star" aria-hidden="true" />
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
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </header>
  );
}

function HaloHero({ variant }: { variant: LandingVariant }) {
  return (
    <section className="lp-halo">
      <p className="lp-badge">{variant.badge}</p>
      <h1>
        {variant.headline} <em>{variant.accent}</em>
      </h1>
      <p className="lp-lead">{variant.sub}</p>
      <div className="lp-hero-actions lp-hero-actions-center">
        <Link className="lp-btn-primary" href="/">
          {variant.cta}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link className="lp-btn-ghost" href="/landing">
          {variant.secondary}
        </Link>
      </div>
      <div className="lp-halo-stage" aria-hidden="true">
        <div className="lp-halo-glow" />
        <div className="lp-globe">
          <span className="lp-ring lp-ring-a" />
          <span className="lp-ring lp-ring-b" />
          <span className="lp-ring lp-ring-c" />
          <div className="lp-globe-media">
            <Image
              src={variant.hero}
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 92vw, 560px"
            />
          </div>
        </div>
        {features.map((feature, index) => (
          <article className={`lp-glass lp-float lp-float-${index + 1}`} key={feature.title}>
            <feature.Icon size={18} aria-hidden="true" />
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </div>
      <div className="lp-trust">
        <p>Файлы не уходят на сервер, пока вы не запустите генерацию.</p>
        <ul>
          {facts.map((fact) => (
            <li key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CoreHero({ variant }: { variant: LandingVariant }) {
  return (
    <section className="lp-core">
      <div className="lp-core-copy">
        <h1>{variant.headline}</h1>
        <p className="lp-lead">{variant.sub}</p>
      </div>
      <div className="lp-hero-actions lp-hero-actions-center">
        <Link className="lp-btn-primary" href="/">
          {variant.cta}
        </Link>
        <Link className="lp-btn-ghost" href="/landing">
          {variant.secondary}
        </Link>
      </div>
      <div className="lp-core-field">
        <div className="lp-core-glow" />
        <div className="lp-core-media">
          <Image
            src={variant.hero}
            alt={variant.heroAlt}
            fill
            priority
            sizes="100vw"
          />
        </div>
      </div>
      <div className="lp-core-meta">
        <p>{variant.badge}</p>
        <span className="lp-mouse" aria-hidden="true" />
        <p>Стиль читается с ваших картинок</p>
      </div>
    </section>
  );
}

function LatticeHero({ variant }: { variant: LandingVariant }) {
  return (
    <section className="lp-lattice">
      <div className="lp-lattice-copy">
        <p className="lp-badge">{variant.badge}</p>
        <h1>{variant.headline}</h1>
        <p className="lp-lead">{variant.sub}</p>
        <div className="lp-hero-actions">
          <Link className="lp-btn-primary" href="/">
            {variant.cta}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link className="lp-btn-ghost" href="/landing">
            {variant.secondary}
          </Link>
        </div>
      </div>
      <div className="lp-lattice-stage">
        <div className="lp-lattice-glow" />
        <div className="lp-lattice-media">
          <Image
            src={variant.hero}
            alt={variant.heroAlt}
            fill
            priority
            sizes="(max-width: 900px) 100vw, 58vw"
          />
        </div>
        {features.slice(0, 2).map((feature, index) => (
          <article className={`lp-glass lp-lattice-card lp-lattice-card-${index + 1}`} key={feature.title}>
            <feature.Icon size={18} aria-hidden="true" />
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LandingPage({ variant }: { variant: LandingVariant }) {
  return (
    <ParallaxRoot className="lp-page" variant={variant.id}>
      <LandingNav variant={variant} />
      {variant.layout === "halo" ? <HaloHero variant={variant} /> : null}
      {variant.layout === "core" ? <CoreHero variant={variant} /> : null}
      {variant.layout === "lattice" ? <LatticeHero variant={variant} /> : null}

      {variant.layout !== "halo" ? (
        <section className="lp-features">
          <h2>От файла до пакета</h2>
          <div className="lp-feature-grid">
            {features.map((feature) => (
              <article className="lp-glass" key={feature.title}>
                <feature.Icon size={18} aria-hidden="true" />
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="lp-close">
        <h2>ДНК собирается с ваших картинок</h2>
        <p>
          Не с палитры продукта. Цвет, тепло, контраст и пропорции кадра
          становятся профилем. Вы правите формулировки и только потом запускаете
          генерацию.
        </p>
        <Link className="lp-btn-primary" href="/">
          {variant.cta}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <footer className="lp-foot">
        <p>postvmeste / {variant.name}</p>
        <Link href="/">Открыть студию</Link>
      </footer>
    </ParallaxRoot>
  );
}
