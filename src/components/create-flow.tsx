"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  ImagePlus,
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
import { reelCoverToPngBlob, slideToSvg, svgToPngBlob } from "@/lib/render";
import { ReelCover } from "@/components/reel-cover";

type Step = "format" | "rubric" | "topic" | "text" | "variants" | "editor";

const FORMAT_OPTIONS: { id: CreativeFormat; icon: typeof Layers3; color: string; bg: string; blurb: string }[] = [
  { id: "carousel", icon: Layers3, color: "#ff5c35", bg: "#fff0e8", blurb: "7 слайдов после выбора сценария" },
  { id: "post", icon: ImageIcon, color: "#3b82f6", bg: "#e8f0ff", blurb: "Три картинки к вашей подписи" },
  { id: "reel", icon: Video, color: "#8b5cf6", bg: "#f0e8ff", blurb: "Обложка для сетки и поиска. Ролик не снимаем" },
];

function parseFormat(value: string | null): CreativeFormat | null {
  if (value === "carousel" || value === "post" || value === "reel") return value;
  return null;
}

function fileIdFromUrl(url: string) {
  const match = url.match(/\/api\/files\/([^/?#]+)/);
  return match?.[1] || "";
}

export function CreateFlow() {
  const store = useStore();
  const router = useRouter();
  const params = useSearchParams();

  const [format, setFormat] = useState<CreativeFormat | null>(() => parseFormat(params.get("format")));
  const [rubricId, setRubricId] = useState<string | null>(params.get("rubric") || null);
  const [step, setStep] = useState<Step>(() => {
    if (params.get("rubric") && parseFormat(params.get("format"))) return "topic";
    return "format";
  });
  const [newRubricName, setNewRubricName] = useState("");
  const [showNewRubric, setShowNewRubric] = useState(false);
  const [topic, setTopic] = useState(params.get("topic") || "");
  const [userText, setUserText] = useState("");
  const [hookDrafts, setHookDrafts] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>(["#ff5c35", "#ffc857", "#f6f1e9", "#191817"]);
  const [inspirationUrl, setInspirationUrl] = useState("");
  const [uploadingRef, setUploadingRef] = useState(false);
  const referenceInput = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (rubric) {
      loadRubricDefaults(rubric);
      setInspirationUrl(rubric.inspirationUrl || "");
    }
  }, [rubric, loadRubricDefaults]);

  function selectFormat(f: CreativeFormat) {
    setFormat(f);
    setError("");
    setStep(rubricId ? "topic" : "rubric");
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

  async function handleReferenceUpload(fileList: FileList | null) {
    if (!rubricId || !fileList?.length) return;
    const remainingSlots = 4 - (rubric?.references?.length || 0);
    if (remainingSlots <= 0) return;
    setUploadingRef(true);
    setError("");
    try {
      for (const file of Array.from(fileList).slice(0, remainingSlots)) {
        await store.uploadReference(rubricId, file);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось загрузить референс");
    } finally {
      setUploadingRef(false);
      if (referenceInput.current) referenceInput.current.value = "";
    }
  }

  async function handleReferenceRemove(url: string) {
    const id = fileIdFromUrl(url);
    if (!id) return;
    try {
      await store.deleteFile(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось удалить референс");
    }
  }

  function saveInspiration() {
    if (!rubricId) return;
    void store.updateRubric(rubricId, { inspirationUrl: inspirationUrl.trim() });
  }

  async function handleGenerateText() {
    if (!topic.trim()) { setError("Введите тему"); return; }
    setDrafting(true);
    setError("");
    try {
      if (format === "reel") {
        const hooks = await store.draftReelHooks(topic.trim(), userText.trim());
        setHookDrafts(hooks);
        if (!userText.trim() && hooks[0]) setUserText(hooks[0]);
      } else {
        const text = await store.draftText(topic.trim());
        setUserText(text);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сгенерировать текст");
    } finally {
      setDrafting(false);
    }
  }

  async function handleGenerate() {
    if (!topic.trim()) { setError("Введите тему"); return; }
    if (!format) {
      setError("Выберите формат — карусель, пост или обложку");
      setStep("format");
      return;
    }
    if (format === "post" && !userText.trim()) {
      setError("Напишите подпись или нажмите «Помочь с текстом»");
      return;
    }

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
        rubricId,
        colors,
        referenceIds: (rubric?.references || []).map(fileIdFromUrl).filter(Boolean),
      });
      if (format === "carousel" && !userText.trim()) setUserText(copy.text);
      const v = generateVariants(
        format,
        topic.trim(),
        format === "post" ? userText.trim() : copy.text,
        rubric,
        store.user,
        colors,
        copy,
      );
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
      } else if (work.format === "reel") {
        downloadBlob(await reelCoverToPngBlob(work), "reel-cover.png");
      } else if (work.slides[0]?.imageUrl) {
        const response = await fetch(work.slides[0].imageUrl, { credentials: "include" });
        if (!response.ok) throw new Error("export");
        downloadBlob(await response.blob(), `${work.format}.png`);
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
                <p className="format-option-blurb">{f.blurb}</p>
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
            <h1>{format === "reel" ? "Тема и обложка" : "Тема и текст"}</h1>
            <p>
              {format === "reel"
                ? "Тема обязательна. Референс со своего рилса помогает попасть в ваш кадр."
                : "Тема, референсы и текст — модель от них оттолкнётся"}
            </p>
          </div>
          {format === "reel" && (
            <div className="flow-promise">
              Мы не снимаем и не монтируем ролик и не обещаем попасть в рекомендации.
              Делаем обложку, чтобы с профиля и из поиска было ясно: это видео стоит открыть.
            </div>
          )}

          <div className="field">
            <label>Формат</label>
            <div className="format-chip-row">
              {FORMAT_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`format-chip ${format === item.id ? "active" : ""}`}
                  onClick={() => { setFormat(item.id); setHookDrafts([]); }}
                >
                  <item.icon size={14} color={item.color} />
                  {FORMAT_LABELS[item.id]}
                </button>
              ))}
            </div>
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
            <label>{format === "reel" ? "Референсы" : "Референсы — до 4 картинок"}</label>
            {format === "reel" && (
              <p className="field-hint">
                Лучше стоп-кадр с лицом из своего рилса или чужие обложки, которые нравятся. До 4 картинок.
              </p>
            )}
            <div className="reference-grid">
              {(rubric?.references || []).map((url) => (
                <div key={url} className="reference-tile">
                  <img src={url} alt="" />
                  <button type="button" className="reference-remove" onClick={() => void handleReferenceRemove(url)}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              {(rubric?.references?.length || 0) < 4 && (
                <button
                  type="button"
                  className="reference-tile reference-add"
                  disabled={!rubricId || uploadingRef || generating}
                  onClick={() => referenceInput.current?.click()}
                >
                  <ImagePlus size={18} />
                  <span>{uploadingRef ? "Загружаю…" : "Добавить"}</span>
                </button>
              )}
            </div>
            <input
              ref={referenceInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => void handleReferenceUpload(e.target.files)}
            />
            <input
              value={inspirationUrl}
              onChange={(e) => setInspirationUrl(e.target.value)}
              onBlur={saveInspiration}
              placeholder="Ссылка, откуда вдохновение — необязательно"
              className="reference-url"
            />
          </div>

          <div className="field">
            <label>
              {format === "post" ? "Подпись поста" : format === "reel" ? "Хук на обложке" : "Текст"}
            </label>
            {format === "reel" && (
              <p className="field-hint">
                По желанию, 3–6 слов. Если оставить пустым — напишем три хука сами.
              </p>
            )}
            <textarea
              rows={format === "reel" ? 2 : 6}
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder={format === "post"
                ? "Это текст публикации. Его «Создать» уже не будет переписывать"
                : format === "reel"
                  ? "Например: Хватит снимать в лоб"
                  : "Вставьте свой текст или сгенерируйте..."}
            />
            <button className="btn-secondary btn-sm" onClick={handleGenerateText} disabled={drafting || generating}>
              <Sparkles size={14} /> {drafting ? "Пишу..." : format === "reel" ? "Предложить хуки" : "Помочь с текстом"}
            </button>
            {format === "reel" && hookDrafts.length > 0 && (
              <div className="hook-drafts">
                {hookDrafts.map((hook) => (
                  <button
                    key={hook}
                    type="button"
                    className={`hook-draft ${userText === hook ? "active" : ""}`}
                    onClick={() => setUserText(hook)}
                  >
                    {hook}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <div className="flow-error"><AlertCircle size={14} /> {error}</div>}

          {generating && (
            <div className="flow-warning">
              {format === "post"
                ? "Рисую три картинки — подождите, не закрывайте вкладку"
                : format === "reel"
                  ? "Рисую три обложки — подождите, не закрывайте вкладку"
                : "Собираю три крючка — подождите, не закрывайте вкладку"}
            </div>
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
              {generating
                ? format === "post" ? "Рисую картинки…" : format === "reel" ? "Рисую обложки…" : "Собираю варианты…"
                : "Создать"} <ArrowRight size={16} />
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
            <h1>
              {format === "post"
                ? "Какая картинка ближе?"
                : format === "reel"
                  ? "Какая обложка ближе?"
                  : "Какой сценарий ближе?"}
            </h1>
            <p>
              {format === "carousel"
                ? "Сейчас только обложка каждого сценария. Остальные 6 слайдов допишем после выбора."
                : format === "post"
                  ? "Три картинки к вашей подписи. Текст публикации уже готов и не меняется."
                  : "Три хука на обложке. Ролик не снимаем — это кадр для сетки и поиска."}
            </p>
          </div>
          <div className="variants-grid">
            {variants.map((v, i) => (
              <button
                key={v.id}
                className={`variant-card ${selectedId === v.id ? "selected" : ""}`}
                onClick={() => !expanding && setSelectedId(v.id)}
              >
                <div className={`variant-preview format-${v.format}`} style={{ background: v.background, color: v.foreground }}>
                  {v.format === "reel" && v.slides[0]?.imageUrl ? (
                    <ReelCover
                      imageUrl={v.slides[0].imageUrl}
                      hook={v.slides[0].text}
                      background={v.background}
                      plaque={v.accent}
                      textColor={v.slides[0].textColor}
                      fontSize={18}
                    />
                  ) : v.slides[0]?.imageUrl ? (
                    <img src={v.slides[0].imageUrl} alt="" className="variant-photo" />
                  ) : (
                    <>
                      <span className="variant-accent" style={{ background: v.accent }} />
                      <span className="variant-eyebrow" style={{ background: v.accent }}>{v.eyebrow}</span>
                      <strong>{v.slides[0]?.text || v.topic}</strong>
                    </>
                  )}
                  <span className="variant-num">0{i + 1}</span>
                  {selectedId === v.id && <span className="variant-check"><Check size={14} /></span>}
                </div>
                <div className="variant-label">
                  <b>{v.eyebrow}</b>
                  {format === "reel" && <small>{v.slides[0]?.text}</small>}
                  {format === "carousel" && <small>{v.layout}</small>}
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
              {work.format === "reel" && work.slides[activeSlide]?.imageUrl ? (
                <>
                  <p className="editor-note">
                    Картинка не переписывается. Хук правите здесь — он должен читаться в центре сетки.
                    Этот же хук можно сказать первой фразой в ролике.
                  </p>
                  <div className="field">
                    <label>Хук на обложке</label>
                    <textarea
                      rows={2}
                      value={work.slides[activeSlide]?.text || ""}
                      onChange={(e) => {
                        const hook = e.target.value;
                        setWork({
                          ...work,
                          reelScript: hook,
                          slides: work.slides.map((slide, index) => (
                            index === activeSlide ? { ...slide, text: hook } : slide
                          )),
                        });
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>Размер шрифта: {work.slides[activeSlide]?.fontSize || 64}</label>
                    <input
                      type="range"
                      min={40}
                      max={88}
                      value={work.slides[activeSlide]?.fontSize || 64}
                      onChange={(e) => updateSlide(activeSlide, { fontSize: Number(e.target.value) })}
                    />
                  </div>
                  <div className="field">
                    <label>Цвет текста</label>
                    <div className="color-chips">
                      {["#ffffff", "#000000", ...colors].map((c) => (
                        <button
                          key={c}
                          className={`color-chip ${work.slides[activeSlide]?.textColor === c ? "active" : ""}`}
                          style={{ background: c }}
                          onClick={() => updateSlide(activeSlide, { textColor: c })}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : work.slides[activeSlide]?.imageUrl ? (
                <p className="editor-note">Картинка без текста. Править можно подпись и хештеги.</p>
              ) : (
                <>
              <div className="field">
                <label>{work.format === "post" ? "Текст на картинке" : "Текст слайда"}</label>
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
                </>
              )}

              <div className="editor-separator" />

              <div className="field">
                <label>
                  {work.format === "post"
                    ? "Подпись — основной текст поста"
                    : work.format === "reel"
                      ? "Подпись ролика — не на обложке"
                      : "Подпись к посту"}
                </label>
                <textarea
                  rows={work.format === "post" ? 8 : 4}
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
                <p className="editor-note">
                  Первая фраза ролика совпадает с хуком. Сценарий и монтаж — ваши.
                </p>
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

            <div className="editor-preview-stack">
              <div className={`editor-preview format-${work.format}`}>
                <SlidePreview work={work} slideIndex={activeSlide} />
              </div>
              {work.format === "reel" && (
                <div className="reel-grid-block">
                  <small>Как в сетке профиля</small>
                  <div className="reel-grid-preview">
                    <ReelCover
                      imageUrl={work.slides[activeSlide]?.imageUrl}
                      hook={work.slides[activeSlide]?.text || ""}
                      background={work.background}
                      plaque={work.accent}
                      textColor={work.slides[activeSlide]?.textColor}
                      fontSize={Math.round((work.slides[activeSlide]?.fontSize || 64) * 0.22)}
                    />
                  </div>
                </div>
              )}
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

  if (work.format === "reel" && slide.imageUrl) {
    return (
      <ReelCover
        imageUrl={slide.imageUrl}
        hook={slide.text}
        background={work.background}
        plaque={work.accent}
        textColor={slide.textColor}
        fontSize={Math.round((slide.fontSize || 64) * 0.36)}
      />
    );
  }

  if (slide.imageUrl) {
    return (
      <div className="slide-preview slide-preview-photo">
        <img src={slide.imageUrl} alt="" />
      </div>
    );
  }

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
