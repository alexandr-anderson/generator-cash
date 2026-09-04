"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { TONES } from "@/lib/types";

export function ProfilePopup({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [audience, setAudience] = useState(store.user?.audience || "");
  const [tone, setTone] = useState(store.user?.tone || "");
  const [colors, setColors] = useState<string[]>(store.user?.colors || ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"]);

  function save() {
    void store.updateProfile({
      audience: audience || undefined,
      tone: tone || undefined,
      colors: colors.length ? colors : undefined,
      profileCompleted: true,
    });
    onClose();
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose}><X size={18} /></button>
        <h2>Дополните профиль</h2>
        <p className="popup-subtitle">Это улучшит генерации. Все поля необязательны.</p>

        <div className="field">
          <label>Кто ваша аудитория?</label>
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Например: предприниматели 25–40 лет" />
        </div>

        <div className="field">
          <label>Тон голоса</label>
          <div className="tone-chips">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                className={`niche-chip ${tone === t ? "selected" : ""}`}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Основные цвета (до 4)</label>
          <div className="color-inputs">
            {colors.map((c, i) => (
              <input
                key={i}
                type="color"
                value={c}
                onChange={(e) => {
                  const next = [...colors];
                  next[i] = e.target.value;
                  setColors(next);
                }}
              />
            ))}
          </div>
        </div>

        <div className="popup-actions">
          <button className="btn-secondary" onClick={onClose}>Пропустить</button>
          <button className="btn-primary" onClick={save}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
