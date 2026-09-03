"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setPending(false);
    setSent(true);
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
          <p className="auth-subtitle">Если такой аккаунт есть, мы отправили ссылку на почту.</p>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <p className="auth-subtitle">Укажите почту — пришлём ссылку на новый пароль.</p>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn-primary btn-full" disabled={pending}>{pending ? "Отправляем…" : "Отправить ссылку"}</button>
          </form>
        )}
        <div className="auth-switch"><Link href="/auth">Назад ко входу</Link></div>
      </div>
    </div>
  );
}
