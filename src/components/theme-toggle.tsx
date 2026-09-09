"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/**
 * Источник правды по теме — атрибут data-theme на <html>: его проставляет
 * инлайн-скрипт из layout ещё до гидрации. Поэтому не заводим своё состояние,
 * а подписываемся на DOM — иначе разметка сервера разойдётся с тем, что уже
 * стоит в браузере.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const getSnapshot = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

// На сервере темы нет: рендерим светлую, дальше DOM поправит.
const getServerSnapshot = (): Theme => "light";

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // приватный режим или запрет хранилища — тема просто не переживёт перезагрузку
  }
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className={`theme-toggle ${className}`.trim()} role="group" aria-label="Тема оформления">
      <button
        type="button"
        className={theme === "light" ? "is-active" : ""}
        aria-pressed={theme === "light"}
        onClick={() => applyTheme("light")}
      >
        Светло
      </button>
      <button
        type="button"
        className={theme === "dark" ? "is-active" : ""}
        aria-pressed={theme === "dark"}
        onClick={() => applyTheme("dark")}
      >
        Темно
      </button>
    </div>
  );
}
