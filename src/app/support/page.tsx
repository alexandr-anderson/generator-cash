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
          Пишите на почту — это единственный канал связи. Отвечаем по рабочим дням.
        </p>
        <p>
          Почта: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <p>
          Сюда же — не пришло письмо подтверждения, сломалась генерация, нужно удалить аккаунт,
          вопрос про персональные данные и про оплату, когда она появится.
        </p>
        <p>
          Если сломалась генерация, напишите почту аккаунта, время и формат: карусель, пост или
          обложка Reels. Лимит за неудачную попытку не списывается — счётчик генераций остаётся
          на месте.
        </p>
      </article>
    </PublicShell>
  );
}
