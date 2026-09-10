"use client";

import { useEffect, useState } from "react";

/**
 * Счётчик «сколько уже идёт» для длинных ожиданий модели.
 *
 * Генерация занимает минуты, а не секунды (п. 47 в docs/work-plan.md), и без
 * бегущей цифры человек решает, что всё зависло, и уходит с вкладки. Ориентир
 * плюс живой счётчик честнее, чем безразмерное «подождите».
 */
export function ElapsedTimer({ hint }: { hint: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <span className="elapsed-timer">
      {hint} · идёт <strong>{mm}:{ss}</strong>
    </span>
  );
}
