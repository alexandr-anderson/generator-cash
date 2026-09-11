"use client";

import { Plus, Sparkles, ChevronRight, Layers3, Image as ImageIcon, Video } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { generationsGenitive } from "@/lib/plural";
import { worksCountLabel } from "@/lib/rubric-copy";
import { WorkThumb } from "@/components/work-thumb";
import { RubricOverflow } from "@/components/rubric-manage";
import { FORMAT_LABELS } from "@/lib/types";

const formatIcons = {
  carousel: Layers3,
  post: ImageIcon,
  reel: Video,
};

export function HomePage() {
  const store = useStore();
  if (!store.user) return null;

  const remaining = store.getGenerationsRemaining();
  const total = store.total;

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          {/* Имени в базе нет, раньше сюда подставлялся кусок почты: «Привет,
              alexandrriver8» читается как строка из лога, а не как обращение. */}
          <h1>Привет!</h1>
          <p className="home-niche">{store.user.niche}</p>
        </div>
        <div className="gen-counter">
          <Sparkles size={16} />
          <span>Осталось <b>{remaining}</b> из {total} {generationsGenitive(total)}</span>
        </div>
      </div>

      <section className="home-section">
        <div className="section-header">
          <h2>Мои рубрики</h2>
          {/* Раньше «Все» вело в /dashboard/create — то есть на первый шаг мастера,
              а не к списку рубрик. Список с переименованием и удалением — в профиле. */}
          <Link href="/dashboard/profile" className="section-link">Все <ChevronRight size={14} /></Link>
        </div>
        <div className="rubric-scroll">
          {store.rubrics.map((r) => (
            <article className="rubric-card" key={r.id}>
              <Link href={`/dashboard/create?rubric=${r.id}`} className="rubric-card-link">
                <div className="rubric-colors">
                  {(r.colors || ["#ff5c35", "#ffc857", "#f6f1e9"]).slice(0, 3).map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </div>
                <b>{r.name}</b>
                {/* Было перечисление форматов шаблона, а у новой рубрики — «Нет шаблонов»:
                    слово «шаблон» человек впервые встречал здесь, в виде отрицания, и
                    читал его как недоделку. Сколько работ в рубрике — понятнее и правда. */}
                <small>{worksCountLabel(store.archive.filter((item) => item.rubricId === r.id).length)}</small>
              </Link>
              <RubricOverflow rubric={r} />
            </article>
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
            <div className="empty-state-sky" aria-hidden />
            <div className="empty-state-content glass">
              <p>Здесь появятся ваши работы</p>
              <Link href="/dashboard/create" className="btn-primary">Создать первую работу</Link>
            </div>
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
