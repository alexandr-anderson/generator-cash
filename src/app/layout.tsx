import type { Metadata } from "next";
import { Onest } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

// Onest, а не Outfit: у Outfit нет кириллицы, весь русский текст ушёл бы в системный шрифт.
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export const metadata: Metadata = {
  title: "postvmeste.ru — ваш контент, только быстрее",
  description: "AI-студия визуального контента для независимых экспертов. Карусели, посты и обложки Reels за минуты.",
};

/**
 * Тему проставляем до первой отрисовки. Иначе тёмный пользователь на каждой
 * загрузке ловит вспышку светлой темы, пока не подхватится React.
 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');
if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col font-[var(--font-onest)]">
        <Suspense fallback={<div className="loading-screen"><div className="loading-spinner" /></div>}>
          <StoreProvider>{children}</StoreProvider>
        </Suspense>
      </body>
    </html>
  );
}
