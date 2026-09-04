"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,

  Layers3,
  Image as ImageIcon,
  Video,
  Plus,
  Sparkles,
  X,

  AlertCircle,
} from "lucide-react";
import JSZip from "jszip";
import { useStore } from "@/lib/store";
import {
  FORMAT_LABELS,
  FORMAT_SIZES,
  type CreativeFormat,
  type CreativeWork,
  type Rubric,
  type SlideContent,
  type Template,
} from "@/lib/types";
import { applySlideTexts, generateVariants } from "@/lib/generate";
import { slideToSvg, svgToPngBlob } from "@/lib/render";

type Step = "format" | "rubric" | "topic" | "text" | "variants" | "editor";

const FORMAT_OPTIONS: { id: CreativeFormat; icon: typeof Layers3; color: string; bg: string }[] = [
  { id: "carousel", icon: Layers3, color: "#ff5c35", bg: "#fff0e8" },
  { id: "post", icon: ImageIcon, color: "#3b82f6", bg: "#e8f0ff" },
  { id: "reel", icon: Video, color: "#8b5cf6", bg: "#f0e8ff" },
];

export function CreateFlow() {
  const store = useStore();
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<Step>(params.get("rubric") ? "topic" : "format");
  const [format, setFormat] = useState<CreativeFormat | null>(null);
  const [rubricId, setRubricId] = useState<string | null>(params.get("rubric") || null);
  const [newRubricName, setNewRubricName] = useState("");
  const [showNewRubric, setShowNewRubric] = useState(false);
  const [topic, setTopic] = useState("");
  const [userText, setUserText] = useState("");
  const [colors, setColors] = useState<string[]>(["#ff5c35", "#ffc857", "#f6f1e9", "#191817"]);
  const [variants, setVariants] = useState<CreativeWork[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [work, setWork] = useState<CreativeWork | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const rubric = store.rubrics.find((r) => r.id === rubricId);

  const loadRubricDefaults = useCallback((r: Rubric) => {
    if (r.colors?.length) setColors(r.colors);

  }, []);

  function selectFormat(f: CreativeFormat) {
    setFormat(f);
    setStep("rubric");
  }

  function selectRubric(id: string) {
    setRubricId(id);
    const r = store.rubrics.find((x) => x.id === id);
    if (r) loadRubricDefaults(r);
    setStep("topic");
  }

  async function createRubric() {
    if (!newRubricName.trim()) return;
    const r = await store.addRubric(newRubricName.trim());
    if (!r) return;
    setRubricId(r.id);
    setShowNewRubric(false);
    setNewRubricName("");
    setStep("topic");
  }

  async function handleGenerateText() {
    if (!topic.trim()) { setError("Введите тему"); return; }
    setDrafting(true);
    setError("");
    try {
      const text = await store.draftText(topic.trim());
      setUserText(text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сгенерировать текст");
    } finally {
      setDrafting(false);
    }
  }

  async function handleGenerate() {
    if (!topic.trim()) { setError("Введите тему"); return; }
    if (!format) { setError("Выберите формат"); return; }

    const remainingNow = store.getGenerationsRemaining();
    if (remainingNow <= 0) {
      setError("Генерации закончились. Обновите подписку.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const copy = await store.composeCopy({
        format,
        topic: topic.trim(),
        text: userText.trim(),
      });
      if (!userText.trim()) setUserText(copy.text);
      const v = generateVariants(format, topic.trim(), copy.text, rubric, store.user, colors, copy);
      setVariants(v);
      setSelectedId(v[0].id);
      setStep("variants");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать варианты. Попробуйте ещё раз.");
    } finally {
      setGenerating(false);
    }
  }

  async function selectVariant() {
    const v = variants.find((x) => x.id === selectedId);
    if (!v || !format) return;

    if (format !== "carousel") {
      setWork(v);
      setActiveSlide(0);
      setError("");
      setStep("editor");
      return;
    }

    setExpanding(true);
    setError("");
    try {
      const slides = await store.expandCarousel({
        topic: topic.trim(),
        text: userText.trim() || v.caption,
        scenario: v.eyebrow,
        firstSlide: v.slides[0]?.text || topic.trim(),
      });
      setWork(applySlideTexts(v, slides));
      setActiveSlide(0);
      setStep("editor");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось дописать слайды. Попробуйте ещё раз.");
    } finally {
      setExpanding(false);
    }
  }

  function updateSlide(index: number, updates: Partial<SlideContent>) {
    if (!work) return;
    setWork({
      ...work,
      slides: work.slides.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    });
  }

  async function handleSave() {
    if (!work || !rubricId) return;
    if (saveAsTemplate && format) {
      const template: Template = {
        layout: work.layout,
        scenario: work.eyebrow,
        decorStyle: "geometric",
        font: "Arial",
        colors: [work.background, work.foreground, work.accent],
        slideCount: work.slides.length,
      };
      await store.saveTemplate(rubricId, format, template);
    }
    if (rubricId && colors.length) {
      await store.updateRubric(rubricId, { colors });
    }
    await store.addWork(work);
  }

  async function handleExport() {
    if (!work) return;
    setExporting(true);
    try {
      await handleSave();

      if (work.format === "carousel") {
        const zip = new JSZip();
        for (let i = 0; i < work.slides.length; i++) {
          const svg = slideToSvg(work, i);
          const png = await svgToPngBlob(svg);
          zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, png);
        }
        const caption = `${work.caption}\n\n${work.hashtags.join(" ")}`;
        zip.file("caption.txt", caption);
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, "carousel.zip");
      } else {
        const svg = slideToSvg(work, 0);
        const png = await svgToPngBlob(svg);
        downloadBlob(png, `${work.format}.png`);
      }
    } catch {
      setError("Ошибка при экспорте. Попробуйте ещё раз.");
    } finally {
      setExporting(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyCaption() {
    if (!work) return;
    const text = `${work.caption}\n\n${work.hashtags.join(" ")}`;
    navigator.clipboard.writeText(text);
  }

  const remaining = store.getGenerationsRemaining();

  return (
    <div className="create-flow">
      {step === "format" && (
        <div className="flow-step flow-center">
          <div className="flow-heading">
            <h1>Что создаём?</h1>
            <p>Выберите формат контента</p>
          </div>
          <div className="format-grid">
            {FORMAT_OPTIONS.map((f) => (
              <button key={f.id} className="format-option" onClick={() => selectFormat(f.id)}>
                <div className="format-option-icon" style={{ background: f.bg }}>
                  <f.icon size={32} color={f.color} />
                </div>
                <h3>{FORMAT_LABELS[f.id]}</h3>
                <span>{FORMAT_SIZES[f.id].label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "rubric" && (
        <div className="flow-step flow-narrow">
          <button className="flow-back" onClick={() => setStep("format")}><ArrowLeft size={16} /> Назад</button>
          <div className="flow-heading">
            <h1>Выберите рубрику</h1>
            <p>Рубрика — серия постов с единым стилем</p>
          </div>
          <div className="rubric-list">
            {store.rubrics.map((r) => (
              <button key={r.id} className="rubric-option" onClick={() => selectRubric(r.id)}>
                <div className="rubric-option-colors">
                  {(r.colors || ["#ddd"]).slice(0, 3).map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </div>
                <div>
                  <b>{r.name}</b>
                  {r.templates?.[format!] && <small className="has-template">Есть шаблон</small>}
                </div>
                <ArrowRight size={16} />
              </button>
            ))}
            {!showNewRubric ? (
              <button className="rubric-option rubric-new" onClick={() => setShowNewRubric(true)}>
                <Plus size={18} />
                <b>Новая рубрика</b>
              </button>
            ) : (
              <div className="new-rubric-form">
                <input
                  value={newRubricName}
                  onChange={(e) => setNewRubricName(e.target.value)}
                  placeholder="Название рубрики"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && createRubric()}
                />
                <button className="btn-primary btn-sm" onClick={createRubric}>Создать</button>
                <button className="btn-secondary btn-sm" onClick={() => setShowNewRubric(false)}>Отмена</button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "topic" && (
        <div className="flow-step flow-narrow">
          <button className="flow-back" onClick={() => setStep("rubric")}><ArrowLeft size={16} /> Назад</button>
          <div className="flow-heading">
            <h1>Тема и текст</h1>
            <p>Введите тему, выберите цвета и подготовьте текст</p>
          </div>

          <div className="field">
            <label>Тема публикации</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Например: 5 ошибок личного бренда"
              className="topic-input"
            />
          </div>

          <div className="field">
            <label>Цвета (3–4)</label>
            <div className="color-picker-row">
              {colors.map((c, i) => (
                <div key={i} className="color-picker-item">
                  <input type="color" value={c} onChange={(e) => {
                    const next = [...colors];
                    next[i] = e.target.value;
                    setColors(next);
                  }} />
                  <small>{c}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Текст</label>
            <textarea
              rows={6}
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="Вставьте свой текст или сгенерируйте..."
            />
            <button className="btn-secondary btn-sm" onClick={handleGenerateText} disabled={drafting || generating}>
              <Sparkles size={14} /> {drafting ? "Пишу..." : "Помочь с текстом"}
            </button>
          </div>

          {error && <div className="flow-error"><AlertCircle size={14} /> {error}</div>}

          {generating && (
            <div className="flow-warning">Собираю три крючка — подождите, не закрывайте вкладку</div>
          )}

          {remaining <= 1 && remaining > 0 && (
            <div className="flow-warning">Осталась {remaining} генерация</div>
          )}
          {remaining <= 0 && (
            <div className="flow-error">
              <AlertCircle size={14} /> Генерации закончились.{" "}
              <button onClick={() => router.push("/dashboard/profile")} className="link-btn">Обновить подписку</button>
            </div>
          )}

          <div className="flow-actions">
            <button
              className="btn-primary btn-lg"
              onClick={handleGenerate}
              disabled={generating || drafting || remaining <= 0}
            >
              {generating ? "Собираю варианты…" : "Создать"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "text" && (
        <div className="flow-step flow-narrow">
          <button className="flow-back" onClick={() => setStep("topic")}><ArrowLeft size={16} /> Назад</button>
          <div className="flow-heading">
            <h1>Текст публикации</h1>
          </div>
          <textarea
            rows={10}
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
          />
          <div className="flow-actions">
            <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? "Собираю варианты…" : "Создать"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "variants" && (
        <div className="flow-step flow-wide">
          <button className="flow-back" onClick={() => setStep("topic")}><ArrowLeft size={16} /> Изменить тему</button>
          <div className="flow-heading flow-center-heading">
            <span className="flow-kicker"><Sparkles size={14} /> 3 ВАРИАНТА</span>
            <h1>Какой сценарий ближе?</h1>
            <p>
              {format === "carousel"
                ? "Сейчас только обложка каждого сценария. Остальные 6 слайдов допишем после выбора."
                : "Три готовых кадра в разных сценариях. В редакторе можно будет поправить."}
            </p>
          </div>
          <div className="variants-grid">
            {variants.map((v, i) => (
              <button
                key={v.id}
                className={`variant-card ${selectedId === v.id ? "selected" : ""}`}
                onClick={() => !expanding && setSelectedId(v.id)}
              >
                <div className="variant-preview" style={{ background: v.background, color: v.foreground }}>
                  <span className="variant-accent" style={{ background: v.accent }} />
                  <span className="variant-eyebrow" style={{ background: v.accent }}>{v.eyebrow}</span>
                  <strong>{v.slides[0]?.text || v.topic}</strong>
                  <span className="variant-num">0{i + 1}</span>
                  {selectedId === v.id && <span className="variant-check"><Check size={14} /></span>}
                </div>
                <div className="variant-label">
                  <b>{v.eyebrow}</b>
                  <small>{v.layout}</small>
                </div>
              </button>
            ))}
          </div>
          {error && <div className="flow-error"><AlertCircle size={14} /> {error}</div>}
          {expanding && (
            <div className="flow-warning">Дописываю остальные слайды выбранного сценария…</div>
          )}
          <div className="flow-actions">
            <button className="btn-primary btn-lg" onClick={selectVariant} disabled={expanding || !selectedId}>
              {expanding
                ? "Дописываю слайды…"
                : format === "carousel"
                  ? "Собрать карусель"
                  : "Открыть в редакторе"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "editor" && work && (
        <div className="editor-layout">
          <aside className="editor-panel">
            <div className="editor-panel-header">
              <button className="flow-back" onClick={() => setStep("variants")}>
                <ArrowLeft size={16} /> Назад
              </button>
              <h2>Редактор</h2>
            </div>

            {work.format === "carousel" && (
              <div className="slide-nav">
                {work.slides.map((_, i) => (
                  <button
                    key={i}
                    className={`slide-nav-btn ${activeSlide === i ? "active" : ""}`}
                    onClick={() => setActiveSlide(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="editor-fields">
              <div className="field">
                <label>Текст слайда</label>
                <textarea
                  rows={3}
                  value={work.slides[activeSlide]?.text || ""}
                  onChange={(e) => updateSlide(activeSlide, { text: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Размер шрифта: {work.slides[activeSlide]?.fontSize || 48}</label>
                <input
                  type="range"
                  min={24}
                  max={96}
                  value={work.slides[activeSlide]?.fontSize || 48}
                  onChange={(e) => updateSlide(activeSlide, { fontSize: Number(e.target.value) })}
                />
              </div>

              <div className="field">
                <label>Цвет текста</label>
                <div className="color-chips">
                  {[...colors, "#000000", "#ffffff"].map((c) => (
                    <button
                      key={c}
                      className={`color-chip ${work.slides[activeSlide]?.textColor === c ? "active" : ""}`}
                      style={{ background: c }}
                      onClick={() => updateSlide(activeSlide, { textColor: c })}
                    />
                  ))}
                </div>
              </div>

              <div className="editor-separator" />

              <div className="field">
                <label>Подпись к посту</label>
                <textarea
                  rows={4}
                  value={work.caption}
                  onChange={(e) => setWork({ ...work, caption: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Хештеги</label>
                <div className="hashtag-list">
                  {work.hashtags.map((h, i) => (
                    <span key={i} className="hashtag-chip">
                      {h}
                      <button onClick={() => setWork({
                        ...work,
                        hashtags: work.hashtags.filter((_, j) => j !== i),
                      })}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              </div>

              {work.format === "reel" && (
                <div className="field">
                  <label>Текст к ролику</label>
                  <textarea
                    rows={4}
                    value={work.reelScript || ""}
                    onChange={(e) => setWork({ ...work, reelScript: e.target.value })}
                    placeholder="Хук + тезисы для ролика..."
                  />
                </div>
              )}

              <div className="editor-separator" />

              <label className="template-check">
                <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
                <span><Check size={12} /></span>
                Сохранить как шаблон для рубрики
              </label>
            </div>
          </aside>

          <div className="editor-canvas-area">
            <div className="editor-toolbar">
              <span className="editor-format-label">{FORMAT_LABELS[work.format]} · {FORMAT_SIZES[work.format].label}</span>
              <div className="editor-toolbar-actions">
                <button className="btn-secondary btn-sm" onClick={copyCaption}>Скопировать подпись</button>
                <button className="btn-primary btn-sm" onClick={handleExport} disabled={exporting}>
                  <Download size={14} /> {exporting ? "Экспорт..." : work.format === "carousel" ? "Скачать ZIP" : "Скачать PNG"}
                </button>
              </div>
            </div>

            <div className={`editor-preview format-${work.format}`}>
              <SlidePreview work={work} slideIndex={activeSlide} />
            </div>

            {work.format === "carousel" && (
              <div className="editor-slide-strip">
                {work.slides.map((slide, i) => (
                  <button
                    key={i}
                    className={`strip-thumb ${activeSlide === i ? "active" : ""}`}
                    onClick={() => setActiveSlide(i)}
                  >
                    <div className="strip-thumb-inner" style={{ background: work.background, color: work.foreground }}>
                      <span>{slide.text.slice(0, 20) || `${i + 1}`}</span>
                    </div>
                    <small>{i + 1}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <div className="toast-error"><AlertCircle size={14} /> {error}</div>}
        </div>
      )}
    </div>
  );
}

function SlidePreview({ work, slideIndex }: { work: CreativeWork; slideIndex: number }) {
  const slide = work.slides[slideIndex];
  if (!slide) return null;

  return (
    <div className="slide-preview" style={{ background: work.background, color: slide.textColor || work.foreground }}>
      <div className="slide-accent-circle" style={{ background: work.accent }} />
      <span className="slide-eyebrow" style={{ background: work.accent }}>
        {work.eyebrow}
      </span>
      <strong className="slide-headline" style={{ fontSize: `${slide.fontSize * 0.6}px` }}>
        {slide.text || "..."}
      </strong>
      <div className="slide-footer">
        <span>{work.brandLabel}</span>
        <span>{slideIndex + 1}</span>
      </div>
    </div>
  );
}
