"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, PlusCircle, Archive, User, Sparkles, LogOut } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { ProfilePopup } from "./profile-popup";

const tabs = [
  { href: "/dashboard", icon: Home, label: "Главная" },
  { href: "/dashboard/create", icon: PlusCircle, label: "Создать" },
  { href: "/dashboard/archive", icon: Archive, label: "Архив" },
  { href: "/dashboard/profile", icon: User, label: "Профиль" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!store.user) router.push("/auth");
  }, [store.user, router]);

  useEffect(() => {
    if (
      store.user &&
      !store.user.profilePopupShown &&
      !store.user.profileCompleted &&
      store.archive.length >= 1
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPopup(true);
    }
  }, [store.user, store.archive.length]);

  if (!store.user) return null;

  const remaining = store.getGenerationsRemaining();
  const total = store.subscription.initialFreeRemaining > 0
    ? 5
    : store.subscription.generationsPerWeek;
  const used = total - remaining;

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <Link href="/dashboard" className="dash-logo">
          <span><Sparkles size={16} /></span>
          <b>postvmeste.ru</b>
        </Link>
        <nav className="dash-nav">
          {tabs.map((t) => {
            const active = t.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(t.href);
            return (
              <Link href={t.href} className={`dash-nav-item ${active ? "active" : ""}`} key={t.href}>
                <t.icon size={18} />{t.label}
              </Link>
            );
          })}
        </nav>
        <div className="dash-sidebar-bottom">
          <div className="gen-card">
            <div className="gen-card-label"><Sparkles size={12} /> Генерации</div>
            <strong>{remaining}</strong>
            <span>из {total} осталось</span>
            <div className="gen-bar"><div style={{ width: `${total > 0 ? ((total - used) / total) * 100 : 0}%` }} /></div>
          </div>
          <button className="dash-nav-item" onClick={() => { store.logout(); router.push("/"); }}>
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

      <main className="dash-main">{children}</main>

      <nav className="dash-tabbar">
        {tabs.map((t) => {
          const active = t.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(t.href);
          return (
            <Link href={t.href} className={`tabbar-item ${active ? "active" : ""}`} key={t.href}>
              <t.icon size={20} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {showPopup && (
        <ProfilePopup
          onClose={() => {
            setShowPopup(false);
            store.markProfilePopupShown();
          }}
        />
      )}
    </div>
  );
}
