"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/legal";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      // Ответ раньше не проверялся вовсе: и отказ почтовика (502), и лимит
      // (3 запроса в час) заканчивались экраном «мы отправили ссылку». Человек
      // час ждал письмо, которое даже не пытались доставить.
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Слишком много попыток подряд. Подождите час и попробуйте снова."
            : `Письмо не ушло — сбой на нашей стороне. Попробуйте ещё раз через несколько минут или напишите на ${SUPPORT_EMAIL}.`,
        );
        return;
      }
      setSent(true);
    } catch {
      setError("Не получилось связаться с сервером. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <span><Sparkles size={16} /></span>
          <b>postvmeste.ru</b>
        </Link>
        <h1>Сброс пароля</h1>
        {sent ? (
          <p className="auth-subtitle">
            Если аккаунт на <b>{email}</b> есть, ссылка уже ушла. Она действует час — проверьте
            почту и папку «Спам».
          </p>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <p className="auth-subtitle">Укажите почту — пришлём ссылку на новый пароль.</p>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn-primary btn-full" disabled={pending}>{pending ? "Отправляем…" : "Отправить ссылку"}</button>
          </form>
        )}
        <div className="auth-switch"><Link href="/auth">Ко входу</Link></div>
      </div>
    </div>
  );
}
