"use client";

import { Trash2, Layers3, Image as ImageIcon, Video, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { FORMAT_LABELS } from "@/lib/types";

const formatIcons = {
  carousel: Layers3,
  post: ImageIcon,
  reel: Video,
};

export function ArchivePage() {
  const store = useStore();

  return (
    <div className="archive-page">
      <div className="page-header">
        <h1>Архив</h1>
        <p>Все созданные работы</p>
      </div>

      {store.archive.length === 0 ? (
        <div className="empty-state">
          <p>Пока ничего нет</p>
          <Link href="/dashboard/create" className="btn-primary">Создать первый контент</Link>
        </div>
      ) : (
        <div className="archive-grid">
          {store.archive.map((item) => {
            const Icon = formatIcons[item.format];
            return (
              <div className="archive-card" key={item.id}>
                <div className="archive-preview" style={{ background: item.background }}>
                  <span style={{ color: item.previewSlide?.textColor || "#fff" }}>
                    {item.previewSlide?.text?.slice(0, 50) || item.topic}
                  </span>
                </div>
                <div className="archive-info">
                  <div className="archive-meta">
                    <Icon size={14} />
                    <span>{FORMAT_LABELS[item.format]}</span>
                    {item.rubricName && <span className="archive-rubric">{item.rubricName}</span>}
                  </div>
                  <b>{item.topic}</b>
                  <small>{new Date(item.createdAt).toLocaleDateString("ru-RU")}</small>
                  <div className="archive-actions">
                    <Link
                      href={`/dashboard/create?rubric=${item.rubricId}&topic=${encodeURIComponent(item.topic)}`}
                      className="btn-secondary btn-xs"
                    >
                      <RefreshCw size={12} /> Создать похожую
                    </Link>
                    <button className="btn-danger btn-xs" onClick={() => void store.deleteWork(item.workId)}>
                      <Trash2 size={12} /> Удалить
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
