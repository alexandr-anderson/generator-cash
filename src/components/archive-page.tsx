"use client";

import { useState } from "react";
import { Trash2, Layers3, Image as ImageIcon, Video, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { FORMAT_LABELS, type ArchiveItem } from "@/lib/types";
import { WorkThumb } from "@/components/work-thumb";

const formatIcons = {
  carousel: Layers3,
  post: ImageIcon,
  reel: Video,
};

export function ArchivePage() {
  const store = useStore();
  const [confirm, setConfirm] = useState<ArchiveItem | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm) return;
    setBusy(true);
    try {
      await store.deleteWork(confirm.workId);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="archive-page">
      <div className="page-header">
        <h1>Архив</h1>
        {/* Из архива нельзя скачать файлы заново: в карточке только «Создать похожую»
            (новая генерация) и «Удалить». Молчать об этом — обещать больше, чем есть. */}
        <p>Все созданные работы. Файлы отсюда не скачать — они уехали к вам при экспорте.</p>
      </div>

      {store.archive.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-sky" aria-hidden />
          <div className="empty-state-content glass">
            <p>Пока ничего нет</p>
            <Link href="/dashboard/create" className="btn-primary">Создать первую работу</Link>
          </div>
        </div>
      ) : (
        <div className="archive-grid">
          {store.archive.map((item) => {
            const Icon = formatIcons[item.format];
            return (
              <div className="archive-card" key={item.id}>
                <WorkThumb
                  className="archive-preview"
                  slide={item.previewSlide}
                  topic={item.topic}
                  background={item.background}
                />
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
                      href={
                        item.rubricId
                          ? `/dashboard/create?rubric=${item.rubricId}&topic=${encodeURIComponent(item.topic)}`
                          : `/dashboard/create?topic=${encodeURIComponent(item.topic)}`
                      }
                      className="btn-secondary btn-xs"
                    >
                      <RefreshCw size={12} /> Создать похожую
                    </Link>
                    {/* Удаление рубрики спрашивает подтверждение, а работа удалялась
                        с одного клика и без возврата. */}
                    <button className="btn-danger btn-xs" onClick={() => setConfirm(item)}>
                      <Trash2 size={12} /> Удалить
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirm && (
        <div className="popup-overlay" onClick={() => !busy && setConfirm(null)}>
          <div
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="delete-work-title"
          >
            <h2 id="delete-work-title">Удалить работу?</h2>
            <p className="popup-subtitle">
              «{confirm.topic}» исчезнет из архива. Отменить нельзя. Скачанные файлы останутся
              у вас на устройстве.
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirm(null)}>
                Отмена
              </button>
              <button type="button" className="btn-danger" disabled={busy} onClick={() => void remove()}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
