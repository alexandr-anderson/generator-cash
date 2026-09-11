"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { NICHES } from "@/lib/types";
import Link from "next/link";

function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const store = useStore();
  const [mode, setMode] = useState<"login" | "register">(
    params.get("mode") === "register" ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState("");

  if (store.user && mode === "login") {
    router.push("/dashboard");
    return null;
  }

  if (checkEmail) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <Link href="/" className="auth-logo">
            <span><Sparkles size={16} /></span>
            <b>postvmeste.ru</b>
          </Link>
          <h1>Проверьте почту</h1>
          <p className="auth-subtitle">
            Мы отправили ссылку на <b>{checkEmail}</b>. Нажмите её — она сразу откроет студию,
            входить отдельно не нужно. Ссылка живёт 48 часов.
          </p>
          <p className="auth-subtitle">
            Письма нет через пять минут? Загляните в папку «Спам», а если и там пусто — напишите
            на <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>, откроем доступ вручную.
          </p>
          <button className="btn-secondary btn-full" onClick={() => { setCheckEmail(""); setMode("login"); }}>
            Ко входу
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "register") {
        if (!email || !password) return setError("Укажите почту и пароль");
        const selectedNiche = niche === "custom" ? customNiche : NICHES.find((n) => n.id === niche)?.label;
        // Чип «Своя ниша» уже нажат, поле под ним пустое: «Выберите нишу» спорило бы
        // с тем, что человек видит на экране.
        if (!selectedNiche) return setError(niche === "custom" ? "Впишите свою нишу" : "Выберите нишу");
        if (!consent) return setError("Нужно согласие с офертой и политикой");
        if (store.user) await store.logout();
        const result = await store.register(email, password, selectedNiche, true);
        if (!result.ok) return setError(result.error || "Ошибка регистрации");
        setCheckEmail(email);
        return;
      }
      // Без этой проверки пустая форма уходила на сервер и возвращалась с
      // «Неверная почта или пароль» — обвинением человеку, который ничего не
      // вводил, плюс потраченная попытка в лимите входа.
      if (!email || !password) return setError("Введите почту и пароль");
      const result = await store.login(email, password);
      if (!result.ok) {
        setError(result.error || "Неверная почта или пароль");
        return;
      }
      router.push("/dashboard");
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

        <h1>{mode === "register" ? "Создать аккаунт" : "Войти"}</h1>
        <p className="auth-subtitle">
          {mode === "register" ? "Пять генераций бесплатно — карта не нужна" : "Введите email и пароль"}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
          </div>

          {mode === "register" && (
            <div className="field">
              <label>Ваша ниша</label>
              <p className="field-hint">Под неё модель пишет тексты. Поменять можно потом в профиле.</p>
              <div className="niche-grid">
                {NICHES.map((n) => (
                  <button
                    type="button"
                    key={n.id}
                    className={`niche-chip ${niche === n.id ? "selected" : ""}`}
                    onClick={() => setNiche(n.id)}
                  >
                    {n.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`niche-chip ${niche === "custom" ? "selected" : ""}`}
                  onClick={() => setNiche("custom")}
                >
                  Своя ниша
                </button>
              </div>
              {niche === "custom" && (
                <input
                  className="custom-niche-input"
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  placeholder="Например: нутрициология"
                />
              )}
            </div>
          )}

          {mode === "register" && (
            <label className="consent-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Соглашаюсь с <Link href="/offer" target="_blank">офертой</Link> и даю согласие на
                обработку персональных данных по{" "}
                <Link href="/privacy" target="_blank">политике конфиденциальности</Link>
              </span>
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary btn-full" disabled={pending}>
            {pending ? "Секунду…" : mode === "register" ? "Создать аккаунт" : "Войти"} <ArrowRight size={16} />
          </button>
        </form>

        {mode === "login" && (
          <div className="auth-switch">
            <Link href="/auth/forgot">Забыли пароль?</Link>
          </div>
        )}

        <div className="auth-switch">
          {mode === "register" ? (
            <span>Уже есть аккаунт? <button type="button" onClick={() => setMode("login")}>Войти</button></span>
          ) : (
            <span>Нет аккаунта? <button type="button" onClick={() => setMode("register")}>Зарегистрироваться</button></span>
          )}
        </div>

        <div className="auth-legal">
          <Link href="/offer">Оферта</Link>
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/support">Поддержка</Link>
        </div>
      </div>
    </div>
  );
}

export function AuthPage() {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="loading-spinner" /></div>}>
      <AuthForm />
    </Suspense>
  );
}
