"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut, Shield, Sparkles, Users } from "lucide-react";
import { useStore } from "@/lib/store";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!store.user) router.push("/auth");
  }, [store.user, router]);

  if (!store.user) return null;

  if (store.user.role !== "admin") {
    return (
      <div className="admin-denied">
        <div className="admin-denied-card">
          <Shield size={22} aria-hidden="true" />
          <h1>Нет доступа</h1>
          <p>Этот раздел только для администраторов.</p>
          <Link href="/dashboard" className="btn-primary">В студию</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-shell admin-shell">
      <aside className="dash-sidebar">
        <Link href="/admin" className="dash-logo">
          <span><Sparkles size={16} /></span>
          <b>Админка</b>
        </Link>
        <nav className="dash-nav">
          <Link href="/admin" className={`dash-nav-item ${pathname === "/admin" ? "active" : ""}`}>
            <Users size={18} />Пользователи
          </Link>
          <Link href="/dashboard" className="dash-nav-item">
            <Sparkles size={18} />Студия
          </Link>
        </nav>
        <div className="dash-sidebar-bottom">
          <button className="dash-nav-item" onClick={async () => { await store.logout(); router.push("/"); }}>
            <LogOut size={18} />Выйти
          </button>
          <div className="dash-user">
            <span className="dash-avatar">{store.user.email[0].toUpperCase()}</span>
            <div>
              <b>{store.user.email.split("@")[0]}</b>
              <small>{store.user.email}</small>
            </div>
          </div>
        </div>
      </aside>
      <header className="admin-topbar">
        <Link href="/admin" className="admin-topbar-brand">Админка</Link>
        <Link href="/dashboard" className="admin-topbar-link">Студия</Link>
        <button type="button" className="admin-topbar-link" onClick={async () => { await store.logout(); router.push("/"); }}>
          Выйти
        </button>
      </header>
      <main className="dash-main">{children}</main>
    </div>
  );
}
