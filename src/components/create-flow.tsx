"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Layers3,
  Image as ImageIcon,
  Video,
  Plus,
  ImagePlus,
  Smartphone,
  Sparkles,
  X,
  AlertCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { RubricOverflow } from "@/components/rubric-manage";
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
import { captionTxt, textFileBlob } from "@/lib/export-package";
import { reelCoverToPngBlob, slideToSvg, svgToPngBlob } from "@/lib/render";
import { scenarioLabel } from "@/lib/ai-types";
import { CarouselSlideFace } from "@/components/carousel-slide";
import { ReelCover } from "@/components/reel-cover";
import { ElapsedTimer } from "@/components/elapsed-timer";
import { readableTail } from "@/lib/stream-preview";

type Step = "format" | "rubric" | "topic" | "text" | "variants" | "editor";
type RetryAction = "generate" | "expand";

const FORMAT_OPTIONS: { id: CreativeFormat; icon: typeof Layers3; color: string; blurb: string }[] = [
  // «Сценарий» в продукте уже занят значением «текст для съёмки» («Сценарий ролика
  // не пишем»), а свой выбор человек везде видит как «заход».
  { id: "carousel", icon: Layers3, color: "#ff5c35", blurb: "Семь слайдов после выбора захода" },
  { id: "post", icon: ImageIcon, color: "#3b82f6", blurb: "Три картинки к вашей подписи" },
  { id: "reel", icon: Video, color: "#8b5cf6", blurb: "Обложка для сетки и поиска. Ролик не снимаем" },
];

function parseFormat(value: string | null): CreativeFormat | null {
  if (value === "carousel" || value === "post" || value === "reel") return value;
  return null;
}

function fileIdFromUrl(url: string) {
  const match = url.match(/\/api\/files\/([^/?#]+)/);
  return match?.[1] || "";
}

function FlowErrorBanner({
  message,
  canRetry,
  busy,
  onRetry,
}: {
  message: string;
  canRetry: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flow-error">
      <AlertCircle size={14} />
      <span>{message}</span>
      {canRetry ? (
        <button type="button" className="link-btn" disabled={busy} onClick={onRetry}>
          Попробовать ещё раз
        </button>
      ) : null}
    </div>
  );
}

export function CreateFlow() {
  const store = useStore();
  const params = useSearchParams();

  const [format, setFormat] = useState<CreativeFormat | null>(() => parseFormat(params.get("format")));
  const [rubricId, setRubricId] = useState<string | null>(params.get("rubric") || null);
  const [step, setStep] = useState<Step>(() => {
    if (params.get("rubric") && parseFormat(params.get("format"))) return "topic";
    return "format";
  });
  const [newRubricName, setNewRubricName] = useState("");
  const [showNewRubric, setShowNewRubric] = useState(false);
  const [rubricError, setRubricError] = useState("");
  const [topic, setTopic] = useState(params.get("topic") || "");
  const [userText, setUserText] = useState("");
  const [reelCaptionDraft, setReelCaptionDraft] = useState("");
  const [hookDrafts, setHookDrafts] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>(
    store.user?.colors?.length ? store.user.colors : ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"],
  );
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
  const [exporting, setExporting] = useState<"zip" | "phone" | "png" | null>(null);
  const [error, setError] = useState("");
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);
  // Текст, который модель печатает прямо сейчас. Сырой поток копим в ref, чтобы
  // каждый чанк не вызывал перерисовку по всей накопленной строке.
  const [progress, setProgress] = useState("");
  const progressRaw = useRef("");
  const appendProgress = useCallback((chunk: string) => {
    progressRaw.current += chunk;
    setProgress(readableTail(progressRaw.current));
  }, []);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rubric = store.rubrics.find((r) => r.id === rubricId);

  const loadRubricDefaults = useCallback(
    (r: Rubric) => {
      setColors(
        r.colors?.length
          ? r.colors
          : store.user?.colors?.length
            ? store.user.colors
            : ["#ff5c35", "#ffc857", "#f6f1e9", "#191817"],
      );
    },
    [store.user],
  );

  useEffect(() => {
    if (rubric) {
      loadRubricDefaults(rubric);
      setInspirationUrl(rubric.inspirationUrl || "");
    }
  }, [rubric, loadRubricDefaults]);

  useEffect(() => {
    if (rubricId && !store.rubrics.some((item) => item.id === rubricId)) {
      setRubricId(null);
      setStep((current) => (current === "format" ? current : "rubric"));
    }
  }, [store.rubrics, rubricId]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

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
    // Раньше обе неудачи были беззвучными: пустое поле — тихий return, упавший
    // запрос — отклонённый промис в пустоту. Кнопка выглядела сломанной, а
    // человеческий текст про обрыв связи из store.tsx до экрана не доезжал.
    if (!newRubricName.trim()) {
      setRubricError("Введите название");
      return;
    }
    setRubricError("");
    try {
      const r = await store.addRubric(newRubricName.trim());
      if (!r) {
        setRubricError("Не удалось создать рубрику. Попробуйте ещё раз.");
        return;
      }
      setRubricId(r.id);
      setShowNewRubric(false);
      setNewRubricName("");
      setStep("topic");
    } catch (caught) {
      setRubricError(
        caught instanceof Error ? caught.message : "Не удалось создать рубрику. Попробуйте ещё раз.",
      );
    }
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
    if (!topic.trim()) { setError("Введите тему"); setRetryAction(null); return; }
    if (!format) {
      setError("Выберите формат — карусель, пост или обложку");
      setRetryAction(null);
      setStep("format");
      return;
    }
    if (format === "post" && !userText.trim()) {
      setError("Напишите подпись или нажмите «Помочь с текстом»");
      setRetryAction(null);
      return;
    }

    const remainingNow = store.getGenerationsRemaining();
    if (remainingNow <= 0) {
      setError(`Генерации закончились. Оплата пока не подключена — тариф меняет поддержка: ${SUPPORT_EMAIL}`);
      setRetryAction(null);
      return;
    }

    setGenerating(true);
    setError("");
    setRetryAction(null);
    setProgress("");
    progressRaw.current = "";
    try {
      const copy = await store.composeCopy({
        format,
        topic: topic.trim(),
        text: userText.trim(),
        captionSource: format === "reel" ? reelCaptionDraft.trim() : undefined,
        rubricId,
        colors,
        referenceIds: (rubric?.references || []).map(fileIdFromUrl).filter(Boolean),
      }, appendProgress);
      if (format === "carousel" && !userText.trim()) setUserText(copy.text);
      const v = generateVariants(
        format,
        topic.trim(),
        format === "post" ? userText.trim() : copy.text,
        rubric,
        store.user,
        colors,
        copy,
        format === "carousel" ? copy.carouselRecipe : null,
      );
      setVariants(v);
      setSelectedId(v[0].id);
      setStep("variants");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать варианты. Попробуйте ещё раз.");
      setRetryAction("generate");
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

    if (store.getGenerationsRemaining() <= 0) {
      setError(`Генерации закончились. Оплата пока не подключена — тариф меняет поддержка: ${SUPPORT_EMAIL}`);
      setRetryAction(null);
      return;
    }

    setExpanding(true);
    setError("");
    setRetryAction(null);
    setProgress("");
    progressRaw.current = "";
    try {
      const expanded = await store.expandCarousel({
        topic: topic.trim(),
        text: userText.trim(),
        scenario: v.eyebrow,
        firstSlide: v.slides[0]?.text || topic.trim(),
      }, appendProgress);
      setWork({
        ...applySlideTexts(v, expanded.slides),
        caption: expanded.caption,
        hashtags: expanded.hashtags,
      });
      setActiveSlide(0);
      setStep("editor");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось дописать слайды. Попробуйте ещё раз.");
      setRetryAction("expand");
    } finally {
      setExpanding(false);
    }
  }

  function retryFailed() {
    if (retryAction === "generate") void handleGenerate();
    if (retryAction === "expand") void selectVariant();
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

  async function handleExport(mode: "zip" | "phone" | "png" = "png") {
    if (!work) return;
    setExporting(mode);
    try {
      await handleSave();
      const captionFile = { name: "caption.txt", blob: textFileBlob(captionTxt(work)) };

      if (work.format === "carousel") {
        const files = await Promise.all(
          work.slides.map(async (_, i) => ({
            name: `slide-${String(i + 1).padStart(2, "0")}.png`,
            blob: await svgToPngBlob(slideToSvg(work, i)),
          })),
        );
        if (mode === "zip") {
          const JSZip = (await import("jszip")).default;
          const zip = new JSZip();
          for (const file of files) zip.file(file.name, file.blob);
          zip.file(captionFile.name, captionFile.blob);
          downloadBlob(await zip.generateAsync({ type: "blob" }), "carousel.zip");
        } else {
          // Раньше в телефонном режиме уезжали только картинки: caption.txt
          // клался лишь в ZIP, и человек оставался без подписи и хештегов,
          // ради которых и ждал генерацию. Восстановить их после ухода со
          // страницы уже нельзя.
          for (const [i, file] of [...files, captionFile].entries()) {
            downloadBlob(file.blob, file.name);
            if (i < files.length) {
              await new Promise((resolve) => setTimeout(resolve, 700));
            }
          }
        }
        return;
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      if (work.format === "reel") {
        zip.file("reel-cover.png", await reelCoverToPngBlob(work));
        zip.file(captionFile.name, captionFile.blob);
        downloadBlob(await zip.generateAsync({ type: "blob" }), "reel.zip");
        return;
      }

      let image = await svgToPngBlob(slideToSvg(work, 0));
      if (work.slides[0]?.imageUrl) {
        const response = await fetch(work.slides[0].imageUrl, { credentials: "include" });
        if (!response.ok) throw new Error("export");
        image = await response.blob();
      }
      zip.file("post.png", image);
      zip.file(captionFile.name, captionFile.blob);
      downloadBlob(await zip.generateAsync({ type: "blob" }), "post.zip");
    } catch {
      setError("Не получилось сохранить и скачать. Попробуйте ещё раз — генерация на это не тратится.");
    } finally {
      setExporting(null);
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

  async function copyCaption() {
    if (!work) return;
    const text = `${work.caption}\n\n${work.hashtags.join(" ")}`.trim();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Не удалось скопировать. Выделите подпись вручную.");
    }
  }

  const remaining = store.getGenerationsRemaining();

  return (
    <div className="create-flow">
      {step === "format" && (
        <div className="flow-step flow-center">
          <div className="flow-heading">
            <h1>Что создаём?</h1>
            <p>Формат можно поменять и дальше — на шаге с темой</p>
          </div>
          <div className="format-grid">
            {FORMAT_OPTIONS.map((f) => (
              <button key={f.id} className="format-option" onClick={() => selectFormat(f.id)}>
                <div className={`format-option-icon format-icon-${f.id}`}>
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
            {/* У нового аккаунта рубрик нет вообще: единственное место, где они
                создаются, — форма ниже. «Выберите» командовало выбрать из пустоты. */}
            <h1>{store.rubrics.length ? "Выберите рубрику" : "Создайте первую рубрику"}</h1>
            <p>Рубрика — серия публикаций с одним закреплённым стилем</p>
          </div>
          <div className="rubric-list">
            {store.rubrics.map((r) => (
              <div className="rubric-option-wrap" key={r.id}>
                <button type="button" className="rubric-option" onClick={() => selectRubric(r.id)}>
                  <div className="rubric-option-colors">
                    {(r.colors || ["#ddd"]).slice(0, 3).map((c, i) => (
                      <span key={i} style={{ background: c }} />
                    ))}
                  </div>
                  <div>
                    <b>{r.name}</b>
                    {/* Метка «Есть шаблон» обещала, что рубрика стартует не с нуля.
                        Сохранённый шаблон при генерации не читает никто (см. generate.ts),
                        так что с меткой и без неё результат одинаковый. Вернуть, когда
                        шаблон начнёт влиять на сборку. */}
                    {r.references?.length ? <small className="has-template">Есть референс</small> : null}
                  </div>
                  <ArrowRight size={16} />
                </button>
                <RubricOverflow rubric={r} variant="inline" />
              </div>
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
                  onChange={(e) => { setNewRubricName(e.target.value); setRubricError(""); }}
                  placeholder="Например: Мифы о похудении"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && createRubric()}
                />
                {/* Не «Создать»: через шаг так называется кнопка, которая тратит
                    генерацию, а здесь заводится папка и ничего не списывается. */}
                <button className="btn-primary btn-sm" onClick={createRubric}>Добавить</button>
                <button className="btn-secondary btn-sm" onClick={() => { setShowNewRubric(false); setRubricError(""); }}>Отмена</button>
              </div>
            )}
            {rubricError && <p className="flow-error" role="alert">{rubricError}</p>}
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
                ? "Тема обязательна. Остальное по желанию: референс, хук и подпись."
                : format === "carousel"
                  // Для карусели «Создать» лимит не списывает: consumeGeneration стоит
                  // в /api/ai/expand. Без этой фразы человек с одной генерацией либо
                  // боится нажать, либо не понимает, почему счётчик не двинулся.
                  ? "Тема обязательна. Соберём в два шага по 2–3 минуты, лимит спишется на втором."
                  : "Тема и текст обязательны. По ним нарисуем три картинки, а сам текст уйдёт в подпись как есть."}
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
            <label>Цвета рубрики</label>
            {/* «(3–4)» обещало выбор количества, которого нет. И главное: handleSave
                при экспорте делает updateRubric({ colors }) — правка тут молча меняет
                цвета всей серии, а не одной работы. */}
            <p className="field-hint">
              Взяли из рубрики. Если поменяете, после скачивания работы они останутся
              цветами рубрики по умолчанию.
            </p>
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
            <label>Референсы</label>
            {/* Ограничения сервера (saveUserBuffer: png/jpeg/webp, 8 МБ) не были названы
                нигде: человек с HEIC или фото на 12 МБ узнавал правило после отказа. */}
            <p className="field-hint">
              До 4 картинок, PNG, JPEG или WEBP до 8 МБ.
              {format === "reel"
                ? " Лучше стоп-кадр с лицом из своего рилса или чужие обложки, которые нравятся."
                : format === "post"
                  ? " Лучше свои фото или картинки в нужном стиле — по ним поймём, какую картинку рисовать."
                  : ""}
            </p>
            {format === "carousel" && (
              <p className="field-hint">
                {rubric?.carouselRecipe
                  ? "Стиль рубрики уже снят с референса. Новые картинки переснимут композицию. Цвета остаются ваши."
                  : "Лучше первый слайд своей или чужой карусели. Композицию сохраним в рубрике, цвета возьмём ваши."}
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
              // Ссылка сохраняется в рубрику и больше нигде не читается: в compose и
              // ai-image.ts inspirationUrl не передаётся. Не обещаем, что по ней сходят.
              placeholder="Ссылка на пример — заметка для себя, на генерацию не влияет"
              className="reference-url"
            />
          </div>

          <div className="field">
            <label>
              {format === "post"
                ? "Подпись поста"
                : format === "reel"
                  ? "Хук на обложке"
                  // «Опора» — внутреннее слово команды; в соседних форматах здесь стоят
                  // понятные «Подпись поста» и «Хук на обложке».
                  : "Черновик для карусели — по желанию"}
            </label>
            {format === "reel" && (
              <p className="field-hint">
                По желанию, 3–6 слов — длиннее обрежем. Ваш хук станет первым вариантом,
                ещё два напишем сами. Если оставить пустым — напишем все три.
              </p>
            )}
            {format === "carousel" && (
              <p className="field-hint">
                Черновик или заметки по желанию. Подпись и хештеги напишем после семи слайдов — ёмко, не лонгридом.
              </p>
            )}
            <textarea
              rows={format === "reel" ? 2 : 6}
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder={format === "post"
                ? "Это текст публикации. Кнопка «Создать» его не перепишет"
                : format === "reel"
                  ? "Например: Хватит снимать в лоб"
                  : "Вставьте свои заметки или нажмите «Помочь с текстом»"}
            />
            <button className="btn-secondary btn-sm" onClick={handleGenerateText} disabled={drafting || generating}>
              <Sparkles size={14} /> {drafting ? "Пишу…" : format === "reel" ? "Предложить хуки" : "Помочь с текстом"}
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

          {format === "reel" && (
            <div className="field">
              <label>Подпись к ролику</label>
              <p className="field-hint">
                Свой текст, транскрипт или саммари. Если пусто — напишем подпись по хуку. Сценарий ролика не пишем.
              </p>
              <textarea
                rows={6}
                value={reelCaptionDraft}
                onChange={(e) => setReelCaptionDraft(e.target.value)}
                placeholder="Например: расшифровка того, что вы говорите в ролике"
              />
            </div>
          )}

          {error && (
            <FlowErrorBanner
              message={error}
              canRetry={retryAction === "generate"}
              busy={generating}
              onRetry={retryFailed}
            />
          )}

          {generating && (
            <div className="flow-warning">
              <ElapsedTimer
                hint={
                  format === "post"
                    ? "Рисую три картинки — обычно 2–3 минуты"
                    : format === "reel"
                      ? "Рисую три обложки — обычно 2–3 минуты"
                    : "Собираю три захода — обычно 2–3 минуты"
                }
              />
              <span className="flow-warning-note">
                {format === "carousel"
                  ? "Не закрывайте вкладку. Дальше будет второй шаг такой же длины — сборка семи слайдов, на нём и спишется лимит."
                  // Для поста и обложки генерация списывается именно здесь
                  // (compose/route.ts), и до сих пор об этом не говорилось ни слова.
                  : "Не закрывайте вкладку. Лимит спишется, только если генерация дойдёт до конца."}
              </span>
              {progress && (
                <span className="flow-progress-text">Модель отвечает: {progress}</span>
              )}
            </div>
          )}

          {remaining <= 1 && remaining > 0 && (
            <div className="flow-warning">
              Осталась последняя генерация
              {format === "carousel" ? ". На этом шаге она не спишется — только на сборке слайдов" : ""}
            </div>
          )}
          {remaining <= 0 && (
            // Кнопка вела в профиль, где все тарифы выключены с подписью «Скоро
            // оплата»: обещала выход, а приводила в комнату без двери.
            <div className="flow-error">
              <AlertCircle size={14} /> Генерации закончились. Оплата пока не подключена — тариф
              меняет поддержка:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="link-btn">{SUPPORT_EMAIL}</a>
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
                  : "Какой заход ближе?"}
            </h1>
            <p>
              {format === "carousel"
                ? "Сейчас только первый слайд каждого захода. Семь слайдов, подпись и хештеги соберём после выбора. Лимит спишется тогда."
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
                <div
                  className={`variant-preview format-${v.format}${v.format === "carousel" ? " variant-preview-slide" : ""}`}
                  style={{ background: v.background, color: v.foreground }}
                >
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
                  ) : v.format === "carousel" ? (
                    <CarouselSlideFace work={v} slideIndex={0} />
                  ) : (
                    <>
                      <span className="variant-accent" style={{ background: v.accent }} />
                      <strong>{v.slides[0]?.text || v.topic}</strong>
                    </>
                  )}
                  <span className="variant-num">0{i + 1}</span>
                  {selectedId === v.id && <span className="variant-check"><Check size={14} /></span>}
                </div>
                <div className="variant-label">
                  <b>{format === "carousel" ? scenarioLabel(v.eyebrow) : v.eyebrow}</b>
                  {format === "reel" && <small>{v.slides[0]?.text}</small>}
                </div>
              </button>
            ))}
          </div>
          {error && (
            <FlowErrorBanner
              message={error}
              canRetry={retryAction === "expand"}
              busy={expanding}
              onRetry={retryFailed}
            />
          )}
          {expanding && (
            <div className="flow-warning">
              <ElapsedTimer hint="Собираю семь слайдов, подпись и хештеги — обычно 2–3 минуты" />
              <span className="flow-warning-note">
                Не закрывайте вкладку. Лимит спишется, только если сборка дойдёт до конца.
              </span>
              {progress && (
                <span className="flow-progress-text">Модель пишет: {progress}</span>
              )}
            </div>
          )}
          <div className="flow-actions">
            <button className="btn-primary btn-lg" onClick={selectVariant} disabled={expanding || !selectedId}>
              {expanding
                ? "Собираю карусель…"
                : format === "carousel"
                  ? "Собрать семь слайдов"
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
                    Картинку здесь не поменять. Нужна другая — вернитесь назад и выберите другой вариант, генерация на это не тратится. Хук правьте тут: он должен читаться в сетке профиля.
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
                <p className="editor-note">На картинке нет текста. Править можно подпись, хештеги — только удалять лишние.</p>
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
                      : "Подпись карусели"}
                </label>
                {work.format === "reel" && (
                  <p className="field-hint">
                    Ваш текст или расшифровку ролика оставили как есть. Если поле было пустым — написали подпись по хуку.
                  </p>
                )}
                <textarea
                  rows={8}
                  value={work.caption}
                  onChange={(e) => setWork({ ...work, caption: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Хештеги</label>
                <p className="field-hint">Лишние удаляйте крестиком, добавить свои пока нельзя. Копируются и скачиваются вместе с подписью.</p>
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

              <div className="editor-separator" />

              {/* handleSave вызывается только изнутри handleExport: ни автосохранения,
                  ни предупреждения при уходе со страницы нет. До этой строки человек
                  мог потратить генерацию, ждать три минуты, поправить текст — и уйти
                  с пустыми руками, ничего об этом не подозревая. */}
              <p className="editor-note">
                Работа сохранится, только когда вы её скачаете. Уйдёте со страницы раньше —
                всё пропадёт.
              </p>

              <label className="template-check">
                <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
                <span><Check size={12} /></span>
                {/* Не «Сохранить»: единственное такое слово на экране стояло у галочки,
                    которая работу не сохраняет — только оформление рубрики. */}
                Запомнить оформление как шаблон рубрики
              </label>
            </div>
          </aside>

          <div className="editor-canvas-area">
            <div className="editor-toolbar">
              <span className="editor-format-label">{FORMAT_LABELS[work.format]} · {FORMAT_SIZES[work.format].label}</span>
              <div className="editor-toolbar-actions">
                <button
                  className={`btn-secondary btn-sm btn-copy${copied ? " is-copied" : ""}`}
                  onClick={() => void copyCaption()}
                  aria-live="polite"
                >
                  {copied ? <Check size={14} className="btn-copy-check" /> : null}
                  {copied ? "Скопировано" : "Скопировать подпись"}
                </button>
                {work.format === "carousel" ? (
                  <div className="export-pair">
                    <button
                      className="export-icon-btn"
                      onClick={() => void handleExport("zip")}
                      disabled={Boolean(exporting)}
                      title="Один ZIP-файл: семь картинок и caption.txt с подписью и хештегами"
                    >
                      <Archive size={16} />
                      {/* «Архив» в продукте уже занят разделом меню: кнопка рядом с
                          «Телефон» читалась как «отправить в мой архив». */}
                      <small>{exporting === "zip" ? "…" : "ZIP"}</small>
                    </button>
                    <button
                      className="export-icon-btn primary"
                      onClick={() => void handleExport("phone")}
                      disabled={Boolean(exporting)}
                      title="Семь картинок и подпись по одному файлу — браузер спросит разрешение на несколько загрузок"
                    >
                      <Smartphone size={16} />
                      <small>{exporting === "phone" ? "…" : "Телефон"}</small>
                    </button>
                  </div>
                ) : (
                  <button className="btn-primary btn-sm" onClick={() => void handleExport("zip")} disabled={Boolean(exporting)}>
                    <Download size={14} /> {exporting ? "Сохраняю…" : "Скачать ZIP"}
                  </button>
                )}
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
                {work.slides.map((_, i) => (
                  <button
                    key={i}
                    className={`strip-thumb ${activeSlide === i ? "active" : ""}`}
                    onClick={() => setActiveSlide(i)}
                  >
                    <div className="strip-thumb-inner">
                      <CarouselSlideFace work={work} slideIndex={i} compact />
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

  return <CarouselSlideFace work={work} slideIndex={slideIndex} />;
}
