import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { LANDING_VARIANTS } from "@/lib/landing-variants";

export const metadata: Metadata = {
  title: "Референсы лендинга - postvmeste",
  description: "Четыре визуальных направления главной страницы AI-студии.",
};

export default function LandingIndexPage() {
  return (
    <div className="lp-page" data-variant="signal">
      <header className="lp-nav">
        <Link className="lp-mark" href="/landing">
          postvmeste
        </Link>
        <span />
        <Link className="lp-nav-cta" href="/">
          Студия
        </Link>
      </header>
      <main className="lp-index">
        <h1>Четыре входа в студию</h1>
        <p>
          Живые референсы главной: ИИ-формат, лёгкий параллакс на CSS, без
          тяжёлых библиотек анимации. Выберите направление.
        </p>
        <div className="lp-board">
          {LANDING_VARIANTS.map((variant) => (
            <Link className="lp-tile" href={`/landing/${variant.id}`} key={variant.id}>
              <Image
                src={variant.hero}
                alt={variant.heroAlt}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
              />
              <span>
                <b>{variant.name}</b>
                <em>{variant.pitch}</em>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
