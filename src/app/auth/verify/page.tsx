"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const store = useStore();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("В ссылке нет токена");
      return;
    }
    void fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ссылка не сработала");
        await store.refresh();
        router.push("/dashboard");
      })
      .catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, router]);

  if (store.user) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <span><Sparkles size={16} /></span>
          <b>postvmeste.ru</b>
        </Link>
        <h1>{error ? "Не получилось" : "Подтверждаем почту…"}</h1>
        <p className="auth-subtitle">{error || "Секунду, открываем студию."}</p>
        {error && <Link href="/auth" className="btn-primary btn-full">Ко входу</Link>}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="loading-spinner" /></div>}>
      <VerifyInner />
    </Suspense>
  );
}
