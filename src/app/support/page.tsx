import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Поддержка — postvmeste.ru",
};

export default function Support() {
  return (
    <PublicShell>
      <article className="legal-doc">
        <p className="legal-kicker">Контакты</p>
        <h1>Поддержка</h1>
        <p className="legal-intro">
          Пишите на почту — это основной канал, пока нет чата. Отвечаем по рабочим дням.
        </p>
        <p>
          Почта: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <p>
          Сюда же — про удаление аккаунта, ошибку генерации, оплату, когда она появится, и персональные данные.
        </p>
      </article>
    </PublicShell>
  );
}
