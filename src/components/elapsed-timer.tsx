"use client";

import { useEffect, useState } from "react";

/**
 * Счётчик «сколько уже идёт» для длинных ожиданий модели.
 *
 * Генерация занимает минуты, а не секунды (п. 47 в docs/work-plan.md), и без
 * бегущей цифры человек решает, что всё зависло, и уходит с вкладки. Ориентир
 * плюс живой счётчик честнее, чем безразмерное «подождите».
 */
/**
 * Выйти за обещанные 2–3 минуты — штатный случай: картинки рисуются по очереди,
 * у каждой свой таймаут, а маршрут ждёт до 300 секунд (maxDuration в compose и
 * expand). Раньше после 3:00 счётчик просто рос молча, и человек решал, что
 * зависло, — и закрывал вкладку ровно тогда, когда генерация уже потрачена.
 */
const OVERTIME_AFTER_SEC = 3 * 60 + 30;

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
  const overtime = seconds >= OVERTIME_AFTER_SEC;

  return (
    <span className="elapsed-timer">
      {overtime ? "Идёт дольше обычного, но ещё не сдались" : hint} · идёт{" "}
      <strong>{mm}:{ss}</strong>
      {overtime ? " · ждём ответа модели до пяти минут" : ""}
    </span>
  );
}
