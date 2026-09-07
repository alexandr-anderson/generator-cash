import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "postvmeste.ru — ваш контент, только быстрее",
  description: "AI-студия визуального контента для независимых экспертов. Карусели, посты и обложки Reels за минуты.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[var(--font-geist-sans)]">
        <Suspense fallback={<div className="loading-screen"><div className="loading-spinner" /></div>}>
          <StoreProvider>{children}</StoreProvider>
        </Suspense>
      </body>
    </html>
  );
}
