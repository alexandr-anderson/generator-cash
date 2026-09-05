"use client";

import { Plus, Sparkles, ChevronRight, Layers3, Image as ImageIcon, Video } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { FORMAT_LABELS } from "@/lib/types";
import { WorkThumb } from "@/components/work-thumb";

const formatIcons = {
  carousel: Layers3,
  post: ImageIcon,
  reel: Video,
};

export function HomePage() {
  const store = useStore();
  if (!store.user) return null;

  const remaining = store.getGenerationsRemaining();
  const total = store.subscription.initialFreeRemaining > 0 ? 5 : store.subscription.generationsPerWeek;

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1>Привет, {store.user.email.split("@")[0]}</h1>
          <p className="home-niche">{store.user.niche}</p>
        </div>
        <div className="gen-counter">
          <Sparkles size={16} />
          <span><b>{remaining}</b> из {total} генераций</span>
        </div>
      </div>

      <section className="home-section">
        <div className="section-header">
          <h2>Мои рубрики</h2>
          <Link href="/dashboard/create" className="section-link">Все <ChevronRight size={14} /></Link>
        </div>
        <div className="rubric-scroll">
          {store.rubrics.map((r) => (
            <Link href={`/dashboard/create?rubric=${r.id}`} className="rubric-card" key={r.id}>
              <div className="rubric-colors">
                {(r.colors || ["#ff5c35", "#ffc857", "#f6f1e9"]).slice(0, 3).map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
              <b>{r.name}</b>
              <small>
                {r.templates
                  ? Object.keys(r.templates).map((f) => FORMAT_LABELS[f as keyof typeof FORMAT_LABELS]).join(", ")
                  : "Нет шаблонов"}
              </small>
            </Link>
          ))}
          <Link href="/dashboard/create" className="rubric-card rubric-add">
            <Plus size={24} />
            <b>Новая рубрика</b>
          </Link>
        </div>
      </section>

      <section className="home-section">
        <div className="section-header">
          <h2>Последние работы</h2>
          <Link href="/dashboard/archive" className="section-link">Все <ChevronRight size={14} /></Link>
        </div>
        {store.archive.length === 0 ? (
          <div className="empty-state">
            <p>Здесь появятся ваши работы</p>
            <Link href="/dashboard/create" className="btn-primary">Создать первый контент</Link>
          </div>
        ) : (
          <div className="works-list">
            {store.archive.slice(0, 6).map((item) => {
              const Icon = formatIcons[item.format];
              return (
                <div className="work-card" key={item.id}>
                  <WorkThumb
                    className="work-preview"
                    slide={item.previewSlide}
                    topic={item.topic}
                    background={item.background}
                  />
                  <div className="work-info">
                    <div className="work-meta">
                      <Icon size={14} />
                      <span>{FORMAT_LABELS[item.format]}</span>
                      {item.rubricName && <span className="work-rubric">{item.rubricName}</span>}
                    </div>
                    <b>{item.topic}</b>
                    <small>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
