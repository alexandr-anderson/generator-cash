import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { LANDING_VARIANTS } from "@/lib/landing-variants";

export const metadata: Metadata = {
  title: "Референсы лендинга - postvmeste",
  description: "Три визуальных направления главной страницы AI-студии.",
};

export default function LandingIndexPage() {
  return (
    <div className="lp-page" data-variant="halo">
      <header className="lp-nav">
        <Link className="lp-mark" href="/landing">
          <span className="lp-mark-star" aria-hidden="true" />
          postvmeste
        </Link>
        <span />
        <Link className="lp-nav-cta" href="/">
          Студия
        </Link>
      </header>
      <main className="lp-index">
        <h1>Три входа в студию</h1>
        <p>
          Живые референсы главной по двум образцам: тёмный глобус со стеклом и
          воздушное нейронное ядро. Параллакс на CSS, без тяжёлых библиотек.
        </p>
        <div className="lp-board">
          {LANDING_VARIANTS.map((variant) => (
            <Link className="lp-tile" href={`/landing/${variant.id}`} key={variant.id}>
              <Image
                src={variant.hero}
                alt={variant.heroAlt}
                fill
                sizes="(max-width: 900px) 100vw, 33vw"
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
