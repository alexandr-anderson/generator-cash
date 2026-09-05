"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Check,
  Search,
  ShieldOff,
  Users,
} from "lucide-react";
import { SUBSCRIPTION_TIERS, type AdminUserFilter, type AdminUserRow, type Subscription } from "@/lib/types";

type AdminListResponse = {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { registered: number; paid: number; banned: number };
  error?: string;
};

const FILTERS: { id: AdminUserFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "paid", label: "С подпиской" },
  { id: "free", label: "Бесплатные" },
  { id: "banned", label: "Заблокированные" },
];

function tierLabel(tier: Subscription["tier"]) {
  return SUBSCRIPTION_TIERS.find((item) => item.tier === tier)?.label || "Бесплатно";
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function adminApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса");
  }
  return data;
}

export function AdminPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filter, setFilter] = useState<AdminUserFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AdminListResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmBan, setConfirmBan] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: debouncedQ,
        filter,
        page: String(page),
        pageSize: "20",
      });
      const payload = await adminApi<AdminListResponse>(`/api/admin/users?${params}`);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  async function patchUser(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    try {
      const result = await adminApi<{ user: AdminUserRow }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setData((current) => current
        ? { ...current, users: current.users.map((item) => item.id === id ? result.user : item) }
        : current);
      if (typeof body.banned === "boolean") {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Пользователи</h1>
        <p>Регистрации, подписки, бесплатные генерации и блокировки.</p>
      </div>

      {data && (
        <div className="admin-stats">
          <div className="admin-stat">
            <small>Зарегистрировано</small>
            <b>{data.stats.registered}</b>
          </div>
          <div className="admin-stat">
            <small>С оплаченным тарифом</small>
            <b>{data.stats.paid}</b>
          </div>
          <div className="admin-stat">
            <small>Заблокировано</small>
            <b>{data.stats.banned}</b>
          </div>
        </div>
      )}

      <div className="admin-toolbar">
        <label className="admin-search">
          <Search size={15} aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по почте"
            aria-label="Поиск по почте"
          />
        </label>
        <div className="admin-filters" role="tablist" aria-label="Фильтр пользователей">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`niche-chip ${filter === item.id ? "selected" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="flow-error" role="alert">{error}</div>}

      {loading && !data ? (
        <div className="admin-loading"><div className="loading-spinner" /></div>
      ) : !data || data.users.length === 0 ? (
        <div className="admin-empty">
          <Users size={22} aria-hidden="true" />
          <p>Пользователей по этому запросу нет.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Подписка</th>
                  <th>Бесплатные</th>
                  <th>Неделя</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    busy={busyId === user.id}
                    onPatch={(body) => patchUser(user.id, body)}
                    onAskBan={() => setConfirmBan(user)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-cards">
            {data.users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                busy={busyId === user.id}
                onPatch={(body) => patchUser(user.id, body)}
                onAskBan={() => setConfirmBan(user)}
              />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="admin-pager">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Назад
              </button>
              <span>{page} из {pageCount}</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Дальше
              </button>
            </div>
          )}
        </>
      )}

      {confirmBan && (
        <div className="popup-overlay" onClick={() => setConfirmBan(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="ban-title">
            <h2 id="ban-title">{confirmBan.bannedAt ? "Разблокировать аккаунт?" : "Заблокировать аккаунт?"}</h2>
            <p className="popup-subtitle">
              {confirmBan.bannedAt
                ? `${confirmBan.email} снова сможет войти.`
                : `${confirmBan.email} не сможет войти, текущие сессии закроются.`}
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirmBan(null)}>Отмена</button>
              <button
                type="button"
                className={confirmBan.bannedAt ? "btn-primary" : "btn-danger"}
                onClick={() => {
                  const id = confirmBan.id;
                  const banned = !confirmBan.bannedAt;
                  setConfirmBan(null);
                  void patchUser(id, { banned });
                }}
              >
                {confirmBan.bannedAt ? "Разблокировать" : "Заблокировать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  busy,
  onPatch,
  onAskBan,
}: {
  user: AdminUserRow;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onAskBan: () => void;
}) {
  return (
    <tr className={user.bannedAt ? "is-banned" : undefined}>
      <td>
        <div className="admin-user-cell">
          <b>{user.email}</b>
          <small>
            {formatDate(user.createdAt)}
            {user.emailVerifiedAt ? "" : " · не подтверждён"}
            {user.role === "admin" ? " · админ" : ""}
          </small>
        </div>
      </td>
      <td>
        <select
          className="admin-select"
          value={user.subscription.tier}
          disabled={busy}
          aria-label={`Тариф ${user.email}`}
          onChange={(e) => onPatch({ tier: e.target.value })}
        >
          {SUBSCRIPTION_TIERS.map((tier) => (
            <option key={tier.tier} value={tier.tier}>{tier.label}</option>
          ))}
        </select>
      </td>
      <td>
        <FreeGensEditor
          value={user.subscription.initialFreeRemaining}
          disabled={busy}
          onSave={(value) => onPatch({ initialFreeRemaining: value })}
        />
      </td>
      <td>
        <span className="admin-week">
          {user.weeklyRemaining} / {user.subscription.generationsPerWeek}
        </span>
      </td>
      <td>
        <StatusPill user={user} />
      </td>
      <td>
        <BanButton user={user} busy={busy} onAskBan={onAskBan} />
      </td>
    </tr>
  );
}

function UserCard({
  user,
  busy,
  onPatch,
  onAskBan,
}: {
  user: AdminUserRow;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onAskBan: () => void;
}) {
  return (
    <article className={`admin-card ${user.bannedAt ? "is-banned" : ""}`}>
      <div className="admin-card-head">
        <div>
          <b>{user.email}</b>
          <small>
            {formatDate(user.createdAt)}
            {user.emailVerifiedAt ? "" : " · не подтверждён"}
          </small>
        </div>
        <StatusPill user={user} />
      </div>
      <label className="admin-card-field">
        <span>Подписка</span>
        <select
          className="admin-select"
          value={user.subscription.tier}
          disabled={busy}
          onChange={(e) => onPatch({ tier: e.target.value })}
        >
          {SUBSCRIPTION_TIERS.map((tier) => (
            <option key={tier.tier} value={tier.tier}>{tier.label}</option>
          ))}
        </select>
      </label>
      <label className="admin-card-field">
        <span>Бесплатные генерации</span>
        <FreeGensEditor
          value={user.subscription.initialFreeRemaining}
          disabled={busy}
          onSave={(value) => onPatch({ initialFreeRemaining: value })}
        />
      </label>
      <p className="admin-week">Неделя: {user.weeklyRemaining} / {user.subscription.generationsPerWeek}</p>
      <BanButton user={user} busy={busy} onAskBan={onAskBan} />
    </article>
  );
}

function StatusPill({ user }: { user: AdminUserRow }) {
  if (user.bannedAt) return <span className="admin-pill danger">Заблокирован</span>;
  if (user.role === "admin") return <span className="admin-pill">Админ</span>;
  if (user.subscription.tier !== "free") {
    return <span className="admin-pill paid">{tierLabel(user.subscription.tier)}</span>;
  }
  return <span className="admin-pill muted">Активен</span>;
}

function BanButton({
  user,
  busy,
  onAskBan,
}: {
  user: AdminUserRow;
  busy: boolean;
  onAskBan: () => void;
}) {
  if (user.role === "admin") return null;
  return (
    <button
      type="button"
      className={`admin-ban-btn ${user.bannedAt ? "" : "danger"}`}
      disabled={busy}
      onClick={onAskBan}
    >
      {user.bannedAt ? <ShieldOff size={14} aria-hidden="true" /> : <Ban size={14} aria-hidden="true" />}
      {user.bannedAt ? "Разблокировать" : "Заблокировать"}
    </button>
  );
}

function FreeGensEditor({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const parsed = Number(draft);
  const dirty = Number.isInteger(parsed) && parsed !== value;

  return (
    <div className="admin-free-edit">
      <input
        type="number"
        min={0}
        max={999}
        step={1}
        value={draft}
        disabled={disabled}
        aria-label="Бесплатные генерации"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty && parsed >= 0) onSave(parsed);
        }}
      />
      <button
        type="button"
        className="btn-primary btn-xs"
        disabled={disabled || !dirty || parsed < 0 || parsed > 999}
        onClick={() => onSave(parsed)}
        aria-label="Сохранить бесплатные генерации"
      >
        <Check size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
