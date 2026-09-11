import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/legal";
import type { ReactNode } from "react";

export function PublicHeader() {
  return (
    <header className="landing-header">
      <div className="landing-container landing-nav">
        <Link href="/" className="landing-logo">
          <span className="landing-logo-icon"><Sparkles size={16} /></span>
          <b>postvmeste.ru</b>
        </Link>
        <div className="landing-nav-links">
          <Link href="/auth">Войти</Link>
          <Link href="/auth?mode=register" className="landing-cta-sm">Попробовать</Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-row">
        <span>postvmeste.ru · {new Date().getFullYear()}</span>
        <nav className="landing-footer-nav">
          <Link href="/offer">Оферта</Link>
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/support">Поддержка</Link>
        </nav>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </div>
      {/* Продукт весь построен вокруг Instagram, а отметки про Meta на публичных
          страницах не было ни одной. Формулировка стандартная для РФ; если юрист
          предложит свою, правится здесь — подвал общий для всех публичных страниц. */}
      <div className="landing-container landing-footer-note">
        Instagram принадлежит компании Meta, признанной экстремистской организацией и
        запрещённой на территории Российской Федерации.
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
