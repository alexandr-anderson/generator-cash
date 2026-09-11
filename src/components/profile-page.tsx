"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, Pencil, Trash2, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { generationsGenitive } from "@/lib/plural";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { NICHES, TONES, SUBSCRIPTION_TIERS } from "@/lib/types";
import { useRubricManage } from "@/components/rubric-manage";

export function ProfilePage() {
  const store = useStore();
  const router = useRouter();
  const { openDelete } = useRubricManage();
  const [editingRubric, setEditingRubric] = useState<string | null>(null);
  const [rubricName, setRubricName] = useState("");
  const [audience, setAudience] = useState(store.user?.audience || "");
  const [tone, setTone] = useState(store.user?.tone || "");
  const [niche, setNiche] = useState(store.user?.niche || "");
  const [colors, setColors] = useState<string[]>(store.user?.colors || ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (!store.user) return null;

  async function saveProfile() {
    setSaving(true);
    setSaveError("");
    try {
      await store.updateProfile({
        audience: audience || undefined,
        tone: tone || undefined,
        niche,
        colors,
        profileCompleted: true,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : "Не удалось сохранить. Попробуйте ещё раз.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditRubric(id: string) {
    const r = store.rubrics.find((x) => x.id === id);
    if (r) { setEditingRubric(id); setRubricName(r.name); }
  }

  function saveRubric() {
    if (editingRubric && rubricName.trim()) {
      void store.updateRubric(editingRubric, { name: rubricName.trim() });
    }
    setEditingRubric(null);
  }

  const remaining = store.getGenerationsRemaining();
  const total = store.total;

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Профиль</h1>
      </div>

      <section className="profile-section">
        {/* «Бренд-анкета» — слово из нашего словаря, а не из словаря автора блога. */}
        <h2>О вашем блоге</h2>
        <p className="muted">Модель опирается на эти поля, когда пишет текст и подбирает картинку.</p>
        <div className="profile-form">
          <div className="field">
            <label>Email</label>
            <input value={store.user.email} disabled />
          </div>
          <div className="field">
            <label>Ниша</label>
            <select value={NICHES.find((n) => n.label === niche)?.id || "custom"} onChange={(e) => {
              const n = NICHES.find((x) => x.id === e.target.value);
              setNiche(n ? n.label : niche);
            }}>
              {NICHES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              <option value="custom">Другое</option>
            </select>
            {!NICHES.find((n) => n.label === niche) && (
              <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ваша ниша" />
            )}
          </div>
          <div className="field">
            <label>Аудитория</label>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Кто ваши подписчики?" />
          </div>
          <div className="field">
            <label>Тон голоса</label>
            <div className="tone-chips">
              {TONES.map((t) => (
                <button key={t} type="button" className={`niche-chip ${tone === t ? "selected" : ""}`} onClick={() => setTone(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Основные цвета</label>
            <div className="color-inputs">
              {colors.map((c, i) => (
                <input key={i} type="color" value={c} onChange={(e) => {
                  const next = [...colors];
                  next[i] = e.target.value;
                  setColors(next);
                }} />
              ))}
            </div>
          </div>
          {/* Раньше после нажатия на экране не менялось ничего, и человек жал
              кнопку повторно, не понимая, сохранилось ли. */}
          <button className="btn-primary" onClick={() => void saveProfile()} disabled={saving}>
            {saving ? "Сохраняем…" : saved ? "Сохранено" : "Сохранить изменения"}
          </button>
          {saveError && <p className="flow-error" role="alert">{saveError}</p>}
        </div>
      </section>

      <section className="profile-section">
        <h2>Подписка</h2>
        <div className="sub-status">
          <div className="sub-current">
            <Sparkles size={16} />
            <span>Текущий план: <b>{SUBSCRIPTION_TIERS.find((t) => t.tier === store.subscription.tier)?.label || "Бесплатно"}</b></span>
            <span className="sub-remaining">Осталось {remaining} из {total} {generationsGenitive(total)}</span>
          </div>
        </div>
        <div className="pricing-grid compact">
          {SUBSCRIPTION_TIERS.filter((t) => t.tier !== "free").map((tier) => (
            <div className={`pricing-card-sm ${store.subscription.tier === tier.tier ? "current" : ""}`} key={tier.tier}>
              <h3>{tier.label}</h3>
              <b>{tier.priceRub} ₽ <span>/ нед.</span></b>
              <p>{tier.description}</p>
              <button className="btn-secondary btn-sm" disabled>
                {store.subscription.tier === tier.tier ? "Текущий" : "Откроется позже"}
              </button>
            </div>
          ))}
        </div>
        <p className="muted pricing-soon">
          Оплата через ЮKassa ещё подключается. Сменить тариф можно через поддержку:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </section>

      <section className="profile-section">
        <h2>Рубрики</h2>
        {store.rubrics.length === 0 ? (
          <p className="muted">Рубрик пока нет. Первая появится, когда вы начнёте первую работу.</p>
        ) : (
          <div className="rubric-manage-list">
            {store.rubrics.map((r) => (
              <div className="rubric-manage-item" key={r.id}>
                {editingRubric === r.id ? (
                  <div className="rubric-edit-row">
                    <input value={rubricName} onChange={(e) => setRubricName(e.target.value)} autoFocus />
                    <button className="btn-primary btn-xs" onClick={saveRubric}><Check size={12} /></button>
                  </div>
                ) : (
                  <>
                    <div>
                      <b>{r.name}</b>
                    </div>
                    <div className="rubric-manage-actions">
                      <button type="button" onClick={() => startEditRubric(r.id)}><Pencil size={14} /></button>
                      <button type="button" onClick={() => openDelete(r)}><Trash2 size={14} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* На телефоне боковая панель скрыта (globals.css, max-width: 768px), а в
          таббаре выхода нет — до этой кнопки выйти из аккаунта с телефона было нечем. */}
      <section className="profile-section">
        <h2>Аккаунт</h2>
        <p className="muted">
          Удалить аккаунт вместе с работами и файлами можно по письму в поддержку:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <button
          className="btn-secondary"
          onClick={async () => { await store.logout(); router.push("/"); }}
        >
          <LogOut size={14} /> Выйти из аккаунта
        </button>
      </section>
    </div>
  );
}
