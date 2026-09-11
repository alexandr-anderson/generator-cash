"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import Link from "next/link";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Не удалось сменить пароль");
        return;
      }
      router.push("/dashboard");
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
        <h1>Новый пароль</h1>
        {/* Без токена форма раньше показывала намертво серую кнопку и молчала о
            причине: человек вводил пароль, жал на мёртвую кнопку и решал, что
            сломан сайт. */}
        {!token ? (
          <>
            <p className="auth-subtitle">
              Ссылка открылась без кода — похоже, она скопировалась не целиком. Откройте её из
              письма ещё раз, полностью, или запросите новую.
            </p>
            <Link href="/auth/forgot" className="btn-primary btn-full">Запросить новую ссылку</Link>
          </>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <p className="auth-subtitle">
              Придумайте новый пароль — минимум 6 символов. Старый перестанет работать, и на других
              устройствах придётся войти заново.
            </p>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn-primary btn-full" disabled={pending}>
              {pending ? "Сохраняем…" : "Сохранить и войти"}
            </button>
          </form>
        )}
        <div className="auth-switch"><Link href="/auth">Ко входу</Link></div>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="loading-spinner" /></div>}>
      <ResetInner />
    </Suspense>
  );
}
