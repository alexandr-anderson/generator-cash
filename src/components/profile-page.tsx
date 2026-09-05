"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { NICHES, TONES, SUBSCRIPTION_TIERS, FORMAT_LABELS } from "@/lib/types";
import { useRubricManage } from "@/components/rubric-manage";

export function ProfilePage() {
  const store = useStore();
  const { openDelete } = useRubricManage();
  const [editingRubric, setEditingRubric] = useState<string | null>(null);
  const [rubricName, setRubricName] = useState("");
  const [audience, setAudience] = useState(store.user?.audience || "");
  const [tone, setTone] = useState(store.user?.tone || "");
  const [niche, setNiche] = useState(store.user?.niche || "");
  const [colors, setColors] = useState<string[]>(store.user?.colors || ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"]);

  if (!store.user) return null;

  function saveProfile() {
    void store.updateProfile({
      audience: audience || undefined,
      tone: tone || undefined,
      niche,
      colors,
      profileCompleted: true,
    });
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
        <h2>Бренд-анкета</h2>
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
          <button className="btn-primary" onClick={saveProfile}>Сохранить изменения</button>
        </div>
      </section>

      <section className="profile-section">
        <h2>Подписка</h2>
        <div className="sub-status">
          <div className="sub-current">
            <Sparkles size={16} />
            <span>Текущий план: <b>{SUBSCRIPTION_TIERS.find((t) => t.tier === store.subscription.tier)?.label || "Бесплатно"}</b></span>
            <span className="sub-remaining">{remaining} из {total} генераций</span>
          </div>
        </div>
        <div className="pricing-grid compact">
          {SUBSCRIPTION_TIERS.filter((t) => t.tier !== "free").map((tier) => (
            <div className={`pricing-card-sm ${store.subscription.tier === tier.tier ? "current" : ""}`} key={tier.tier}>
              <h3>{tier.label}</h3>
              <b>{tier.priceRub} ₽ <span>/ нед.</span></b>
              <p>{tier.description}</p>
              <button
                className={store.subscription.tier === tier.tier ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
                onClick={() => void store.upgradeTier(tier.tier)}
                disabled={store.subscription.tier === tier.tier}
              >
                {store.subscription.tier === tier.tier ? "Текущий" : "Выбрать"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="profile-section">
        <h2>Рубрики</h2>
        {store.rubrics.length === 0 ? (
          <p className="muted">Рубрик пока нет. Создайте первую при создании контента.</p>
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
                      {r.templates && (
                        <small>Шаблоны: {Object.keys(r.templates).map((f) => FORMAT_LABELS[f as keyof typeof FORMAT_LABELS]).join(", ")}</small>
                      )}
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
    </div>
  );
}
