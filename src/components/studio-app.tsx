"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FileImage,
  Folder,
  Grid2X2,
  ImagePlus,
  Layers3,
  LayoutTemplate,
  MoreHorizontal,
  Palette,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import JSZip from "jszip";
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { analyzeBrandSources, profileConfidence } from "@/lib/brand-analysis";
import {
  createDirections,
  creativeToSvg,
  duplicateForFormat,
} from "@/lib/creative";
import { readReferenceSignals } from "@/lib/reference-signals";
import type {
  CreativeBrief,
  CreativeDirection,
  CreativeFormat,
  ProjectStep,
  StyleProfile,
} from "@/lib/types";

const steps: { id: ProjectStep; label: string }[] = [
  { id: "sources", label: "Материалы" },
  { id: "dna", label: "Brand DNA" },
  { id: "brief", label: "Бриф" },
  { id: "generate", label: "Концепции" },
  { id: "edit", label: "Редактор" },
];

const emptyBrief: CreativeBrief = {
  topic: "5 ошибок личного бренда",
  audience: "Креаторы и эксперты",
  goal: "Дать пользу и получить сохранения",
  cta: "Сохраните, чтобы не потерять",
  mood: "Спокойно и уверенно",
};

type UploadedSource = {
  id: string;
  file: File;
  preview: string;
};

const stepIndex = (step: ProjectStep) => steps.findIndex((item) => item.id === step);

export default function StudioApp() {
  const [step, setStep] = useState<ProjectStep>("sources");
  const [sources, setSources] = useState<UploadedSource[]>([]);
  const [brandName, setBrandName] = useState("Личный бренд");
  const [consent, setConsent] = useState(false);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [brief, setBrief] = useState<CreativeBrief>(emptyBrief);
  const [directions, setDirections] = useState<CreativeDirection[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [creative, setCreative] = useState<CreativeDirection | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [toast, setToast] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const selectedDirection = useMemo(
    () => directions.find((direction) => direction.id === selectedId),
    [directions, selectedId],
  );

  useEffect(() => {
    return () => sources.forEach((source) => URL.revokeObjectURL(source.preview));
  }, [sources]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    const next = files.slice(0, Math.max(0, 20 - sources.length)).map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setSources((current) => [...current, ...next]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function removeSource(id: string) {
    setSources((current) => {
      const removed = current.find((source) => source.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return current.filter((source) => source.id !== id);
    });
  }

  async function analyzeSources() {
    if (!consent) return notify("Подтвердите права на материалы");
    if (!sources.length) return notify("Добавьте хотя бы один референс");

    setAnalyzing(true);
    try {
      const signals = await Promise.all(
        sources.map(({ file }) => readReferenceSignals(file)),
      );
      setProfile(analyzeBrandSources(signals, brandName));
      setStep("dna");
    } catch {
      notify("Не удалось прочитать референсы. Попробуйте PNG, JPEG или WEBP.");
    } finally {
      setAnalyzing(false);
    }
  }

  function approveProfile() {
    if (!profile) return;
    setProfile({ ...profile, approved: true });
    setStep("brief");
  }

  function generateDirections() {
    if (!profile || !brief.topic.trim()) {
      return notify("Добавьте тему публикации");
    }
    const nextDirections = createDirections(profile, brief);
    setDirections(nextDirections);
    setSelectedId(nextDirections[0].id);
    setStep("generate");
  }

  function openEditor() {
    if (!selectedDirection) return;
    setCreative(selectedDirection);
    setActiveSlide(0);
    setStep("edit");
  }

  function chooseFormat(format: CreativeFormat) {
    if (!creative) return;
    setCreative(duplicateForFormat(creative, format));
    setActiveSlide(0);
  }

  async function svgToPngBlob(svg: string) {
    return new Promise<Blob>((resolve, reject) => {
      const image = new Image();
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(url);
          return reject(new Error("Canvas is unavailable"));
        }
        context.drawImage(image, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("PNG export failed"));
        }, "image/png");
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  async function exportCreative() {
    if (!creative) return;
    const zip = new JSZip();
    const slides = creative.format === "carousel" ? creative.slides : [creative.headline];
    await Promise.all(
      slides.map(async (_, index) => {
        const png = await svgToPngBlob(creativeToSvg(creative, index));
        zip.file(`${creative.format}-${String(index + 1).padStart(2, "0")}.png`, png);
      }),
    );
    zip.file(
      "provenance.json",
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          sourceCount: sources.length,
          styleProfile: profile?.name,
          creativeBrief: brief,
          generator: "Local demo provider v1",
          syntheticContent: true,
        },
        null,
        2,
      ),
    );
    const archive = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(archive);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "postvmeste-content-pack.zip";
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Пакет экспортирован");
  }

  function resetProject() {
    sources.forEach((source) => URL.revokeObjectURL(source.preview));
    setSources([]);
    setProfile(null);
    setDirections([]);
    setCreative(null);
    setBrief(emptyBrief);
    setConsent(false);
    setStep("sources");
    notify("Проект и локальные материалы удалены");
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <Topbar brandName={brandName} step={step} />
        <div className="project-progress">
          {steps.map((item, index) => {
            const status = index < stepIndex(step) ? "done" : item.id === step ? "active" : "";
            return (
              <button
                className={`progress-step ${status}`}
                key={item.id}
                onClick={() => index <= stepIndex(step) && setStep(item.id)}
              >
                <span>{status === "done" ? <Check size={13} /> : index + 1}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        <section className={`stage stage-${step}`}>
          {step === "sources" && (
            <SourcesStage
              brandName={brandName}
              consent={consent}
              sources={sources}
              onBrandName={setBrandName}
              onConsent={setConsent}
              onFiles={addFiles}
              onDrop={handleDrop}
              onRemove={removeSource}
              onAnalyze={analyzeSources}
              analyzing={analyzing}
            />
          )}
          {step === "dna" && profile && (
            <DnaStage
              profile={profile}
              sources={sources}
              onChange={setProfile}
              onBack={() => setStep("sources")}
              onApprove={approveProfile}
            />
          )}
          {step === "brief" && profile && (
            <BriefStage
              brief={brief}
              profile={profile}
              onChange={setBrief}
              onBack={() => setStep("dna")}
              onGenerate={generateDirections}
            />
          )}
          {step === "generate" && (
            <DirectionsStage
              directions={directions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onBack={() => setStep("brief")}
              onOpen={openEditor}
            />
          )}
          {step === "edit" && creative && (
            <EditorStage
              creative={creative}
              activeSlide={activeSlide}
              onSlide={setActiveSlide}
              onChange={setCreative}
              onFormat={chooseFormat}
              onBack={() => setStep("generate")}
              onExport={exportCreative}
              onReset={resetProject}
            />
          )}
        </section>
      </main>
      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span><Sparkles size={18} /></span>
        <b>postvmeste.ru</b>
      </div>
      <nav>
        <button className="nav-item active"><Grid2X2 size={18} />Проекты</button>
        <button className="nav-item"><Palette size={18} />Мой стиль</button>
        <button className="nav-item"><LayoutTemplate size={18} />Шаблоны</button>
        <button className="nav-item"><Folder size={18} />Медиатека</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="plan-card">
          <div><Sparkles size={14} /> Free plan</div>
          <strong>7 из 10</strong>
          <p>генераций осталось</p>
          <span><i style={{ width: "70%" }} /></span>
        </div>
        <button className="nav-item"><Settings2 size={18} />Настройки</button>
        <div className="user-card">
          <span>А</span>
          <div><b>Алекс</b><small>hello@postvmeste.ru</small></div>
          <MoreHorizontal size={17} />
        </div>
      </div>
    </aside>
  );
}

function Topbar({ brandName, step }: { brandName: string; step: ProjectStep }) {
  return (
    <header className="topbar">
      <div>
        <button className="icon-button" aria-label="Назад"><ArrowLeft size={18} /></button>
        <div><small>ПРОЕКТ</small><h1>{brandName || "Новый проект"}</h1></div>
      </div>
      <div className="top-actions">
        <span className="saved"><span />Все изменения сохранены</span>
        {step !== "edit" && <button className="secondary-button"><Clock3 size={16} />История</button>}
      </div>
    </header>
  );
}

type SourcesStageProps = {
  brandName: string;
  consent: boolean;
  sources: UploadedSource[];
  onBrandName: (value: string) => void;
  onConsent: (value: boolean) => void;
  onFiles: (files: FileList) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onRemove: (id: string) => void;
  onAnalyze: () => void;
  analyzing: boolean;
};

function SourcesStage(props: SourcesStageProps) {
  return (
    <div className="narrow-stage">
      <div className="stage-heading">
        <span className="kicker"><WandSparkles size={15} />ШАГ 1 ИЗ 5</span>
        <h2>Покажите, как выглядит ваш стиль</h2>
        <p>Добавьте публикации, которые хорошо вас представляют. Мы найдём повторяющиеся визуальные и текстовые паттерны.</p>
      </div>

      <div className="field-group">
        <label htmlFor="brand-name">Название профиля</label>
        <input id="brand-name" value={props.brandName} onChange={(event) => props.onBrandName(event.target.value)} />
      </div>

      <label
        className="dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={props.onDrop}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && props.onFiles(event.target.files)}
        />
        <span className="upload-icon"><UploadCloud size={23} /></span>
        <strong>Перетащите публикации сюда</strong>
        <p>или <u>выберите файлы</u> · PNG, JPG, WEBP до 20 файлов</p>
      </label>

      {props.sources.length > 0 && (
        <div className="source-section">
          <div className="section-label">
            <span>Материалы <b>{props.sources.length}</b></span>
            <small>Рекомендуем 10–20</small>
          </div>
          <div className="source-grid">
            {props.sources.map((source) => (
              <div className="source-tile" key={source.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={source.preview} alt="" />
                <button onClick={() => props.onRemove(source.id)} aria-label="Удалить"><X size={14} /></button>
                <span>{source.file.name}</span>
              </div>
            ))}
            <label className="source-add">
              <input type="file" accept="image/*" multiple onChange={(event) => event.target.files && props.onFiles(event.target.files)} />
              <ImagePlus size={20} /><span>Добавить</span>
            </label>
          </div>
        </div>
      )}

      <label className="consent-row">
        <input type="checkbox" checked={props.consent} onChange={(event) => props.onConsent(event.target.checked)} />
        <span><Check size={13} /></span>
        <p>Я подтверждаю, что владею этими материалами или имею право их использовать. Файлы обрабатываются локально в этом прототипе.</p>
      </label>

      <div className="stage-actions end">
        <button className="primary-button" onClick={props.onAnalyze} disabled={props.analyzing}>
          {props.analyzing ? "Читаю референсы…" : "Найти мой Brand DNA"} <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function DnaStage({
  profile,
  sources,
  onChange,
  onBack,
  onApprove,
}: {
  profile: StyleProfile;
  sources: UploadedSource[];
  onChange: (profile: StyleProfile) => void;
  onBack: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="wide-stage">
      <div className="stage-heading split-heading">
        <div>
          <span className="kicker"><Sparkles size={15} />BRAND DNA ГОТОВ</span>
          <h2>Вот что делает ваш контент узнаваемым</h2>
          <p>Проверьте выводы и поправьте формулировки. Этот профиль станет основой всех генераций.</p>
        </div>
        <div className="confidence-ring"><b>{profileConfidence(profile)}%</b><span>точность</span></div>
      </div>

      <div className="dna-layout">
        <div className="dna-main">
          <article className="panel summary-panel">
            <div className="panel-title"><div><Sparkles size={18} /><b>Суть стиля</b></div><span>AI summary</span></div>
            <textarea
              value={profile.summary}
              onChange={(event) => onChange({ ...profile, summary: event.target.value })}
              rows={4}
            />
          </article>
          <div className="trait-grid">
            {profile.traits.map((trait) => (
              <article className="panel trait-card" key={trait.id}>
                <div className="trait-top"><span>{trait.label}</span><b>{trait.confidence}%</b></div>
                <textarea
                  value={trait.value}
                  onChange={(event) =>
                    onChange({
                      ...profile,
                      traits: profile.traits.map((item) =>
                        item.id === trait.id ? { ...item, value: event.target.value } : item,
                      ),
                    })
                  }
                  rows={2}
                />
                <div className="evidence-row">
                  <Layers3 size={13} />
                  {trait.evidence.length} подтверждения
                </div>
              </article>
            ))}
          </div>
        </div>
        <aside className="dna-aside">
          <article className="panel palette-panel">
            <div className="panel-title"><div><Palette size={18} /><b>Палитра</b></div></div>
            <div className="swatches">
              {profile.colors.map((color, index) => (
                <label key={`${color}-${index}`} style={{ background: color }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(event) =>
                      onChange({
                        ...profile,
                        colors: profile.colors.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="hex-list">{profile.colors.map((color) => <code key={color}>{color}</code>)}</div>
          </article>
          <article className="panel references-panel">
            <div className="panel-title"><div><FileImage size={18} /><b>Основано на</b></div><span>{sources.length} файлов</span></div>
            <div className="reference-stack">
              {sources.slice(0, 4).map((source) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={source.preview} alt="" key={source.id} />
              ))}
            </div>
            <p>Выводы опираются только на выбранные вами материалы.</p>
          </article>
        </aside>
      </div>
      <div className="stage-actions">
        <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} />Назад</button>
        <button className="primary-button" onClick={onApprove}>Утвердить профиль <ArrowRight size={17} /></button>
      </div>
    </div>
  );
}

function BriefStage({
  brief,
  profile,
  onChange,
  onBack,
  onGenerate,
}: {
  brief: CreativeBrief;
  profile: StyleProfile;
  onChange: (brief: CreativeBrief) => void;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const fields: { key: keyof CreativeBrief; label: string; hint: string }[] = [
    { key: "topic", label: "О чём публикация?", hint: "Например: 5 ошибок в личном бренде" },
    { key: "audience", label: "Для кого?", hint: "Креаторы, эксперты, предприниматели…" },
    { key: "goal", label: "Какой результат нужен?", hint: "Сохранения, комментарии, переходы…" },
    { key: "cta", label: "Призыв к действию", hint: "Сохраните, подпишитесь, напишите…" },
  ];
  return (
    <div className="brief-layout">
      <div className="brief-form">
        <div className="stage-heading">
          <span className="kicker"><WandSparkles size={15} />НОВАЯ ИДЕЯ</span>
          <h2>Что создаём сегодня?</h2>
          <p>Дайте короткий контекст. Стиль, композицию и цвета мы уже знаем.</p>
        </div>
        {fields.map((field) => (
          <div className="field-group" key={field.key}>
            <label htmlFor={field.key}>{field.label}</label>
            {field.key === "topic" ? (
              <textarea
                id={field.key}
                rows={3}
                placeholder={field.hint}
                value={brief[field.key]}
                onChange={(event) => onChange({ ...brief, [field.key]: event.target.value })}
              />
            ) : (
              <input
                id={field.key}
                placeholder={field.hint}
                value={brief[field.key]}
                onChange={(event) => onChange({ ...brief, [field.key]: event.target.value })}
              />
            )}
          </div>
        ))}
        <div className="field-group">
          <label>Настроение</label>
          <div className="chip-row">
            {["Спокойно и уверенно", "Смело и провокационно", "Тепло и лично"].map((mood) => (
              <button className={brief.mood === mood ? "selected" : ""} key={mood} onClick={() => onChange({ ...brief, mood })}>{mood}</button>
            ))}
          </div>
        </div>
        <div className="stage-actions">
          <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} />Назад</button>
          <button className="primary-button" onClick={onGenerate}><Sparkles size={16} />Создать 3 концепции</button>
        </div>
      </div>
      <aside className="profile-glance">
        <span className="glance-label">АКТИВНЫЙ СТИЛЬ</span>
        <h3>{profile.name}</h3>
        <p>{profile.summary}</p>
        <div className="mini-swatches">{profile.colors.map((color) => <span style={{ background: color }} key={color} />)}</div>
        <div className="glance-traits">{profile.traits.slice(0, 3).map((trait) => <span key={trait.id}><Check size={12} />{trait.value}</span>)}</div>
      </aside>
    </div>
  );
}

function DirectionsStage({
  directions,
  selectedId,
  onSelect,
  onBack,
  onOpen,
}: {
  directions: CreativeDirection[];
  selectedId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="wide-stage">
      <div className="stage-heading center-heading">
        <span className="kicker"><Sparkles size={15} />3 НАПРАВЛЕНИЯ</span>
        <h2>Выберите визуальную идею</h2>
        <p>Каждая уже использует ваш Brand DNA. В редакторе можно изменить текст, цвет и формат.</p>
      </div>
      <div className="directions-grid">
        {directions.map((direction, index) => (
          <button
            className={`direction-card ${selectedId === direction.id ? "selected" : ""}`}
            key={direction.id}
            onClick={() => onSelect(direction.id)}
          >
            <div className="direction-preview">
              <CreativeCanvas creative={direction} />
              <span className="direction-number">0{index + 1}</span>
              {selectedId === direction.id && <span className="selected-check"><Check size={15} /></span>}
            </div>
            <div className="direction-copy">
              <div><b>{direction.name}</b><small>{direction.rationale}</small></div>
              <ChevronRight size={18} />
            </div>
          </button>
        ))}
      </div>
      <div className="generation-note"><Sparkles size={15} /><span>Контент создан локальным demo-провайдером. Подключите AI-адаптер для production-генераций.</span></div>
      <div className="stage-actions">
        <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} />Изменить бриф</button>
        <button className="primary-button" onClick={onOpen}>Открыть в редакторе <ArrowRight size={17} /></button>
      </div>
    </div>
  );
}

function EditorStage({
  creative,
  activeSlide,
  onSlide,
  onChange,
  onFormat,
  onBack,
  onExport,
  onReset,
}: {
  creative: CreativeDirection;
  activeSlide: number;
  onSlide: (slide: number) => void;
  onChange: (creative: CreativeDirection) => void;
  onFormat: (format: CreativeFormat) => void;
  onBack: () => void;
  onExport: () => void;
  onReset: () => void;
}) {
  return (
    <div className="editor-shell">
      <aside className="editor-controls">
        <div className="editor-title"><button className="icon-button" onClick={onBack}><ArrowLeft size={17} /></button><div><b>Редактор</b><small>Автосохранение включено</small></div></div>
        <div className="control-section">
          <label>Формат</label>
          <div className="format-tabs">
            {([
              ["reel", "9:16", "Reels"],
              ["post", "4:5", "Пост"],
              ["carousel", "4:5", "Карусель"],
            ] as [CreativeFormat, string, string][]).map(([format, ratio, label]) => (
              <button className={creative.format === format ? "selected" : ""} key={format} onClick={() => onFormat(format)}>
                <i>{ratio}</i><span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="control-section">
          <label htmlFor="headline">Заголовок</label>
          <textarea id="headline" rows={4} value={creative.headline} onChange={(event) => onChange({ ...creative, headline: event.target.value })} />
          <small>{creative.headline.length} символов · рекомендуем до 48</small>
        </div>
        <div className="control-section">
          <label htmlFor="eyebrow">Рубрика</label>
          <input id="eyebrow" value={creative.eyebrow} onChange={(event) => onChange({ ...creative, eyebrow: event.target.value })} />
        </div>
        <div className="control-section">
          <label htmlFor="footer">Подпись</label>
          <input id="footer" value={creative.body} onChange={(event) => onChange({ ...creative, body: event.target.value })} />
        </div>
        <div className="control-section color-controls">
          <label>Цвета</label>
          <div>
            <span>Фон<input type="color" value={creative.background} onChange={(event) => onChange({ ...creative, background: event.target.value })} /></span>
            <span>Текст<input type="color" value={creative.foreground} onChange={(event) => onChange({ ...creative, foreground: event.target.value })} /></span>
            <span>Акцент<input type="color" value={creative.accent} onChange={(event) => onChange({ ...creative, accent: event.target.value })} /></span>
          </div>
        </div>
        <button className="danger-link" onClick={onReset}><Trash2 size={15} />Удалить проект и данные</button>
      </aside>
      <div className="canvas-workspace">
        <div className="canvas-toolbar">
          <div><button className="icon-button"><RotateCcw size={16} /></button><span>100%</span></div>
          <button className="primary-button" onClick={onExport}><Download size={16} />Экспортировать ZIP</button>
        </div>
        <div className={`canvas-frame format-${creative.format}`}>
          <CreativeCanvas creative={creative} slide={activeSlide} />
        </div>
        {creative.format === "carousel" && (
          <div className="slide-strip">
            {creative.slides.map((slide, index) => (
              <button className={activeSlide === index ? "selected" : ""} key={`${slide}-${index}`} onClick={() => onSlide(index)}>
                <span>{index + 1}</span><CreativeCanvas creative={creative} slide={index} />
              </button>
            ))}
            <button className="add-slide"><Plus size={18} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreativeCanvas({ creative, slide = 0 }: { creative: CreativeDirection; slide?: number }) {
  const headline = creative.format === "carousel" ? creative.slides[slide] ?? creative.headline : creative.headline;
  return (
    <div className="creative-canvas" style={{ background: creative.background, color: creative.foreground }}>
      <div className="art-circle" style={{ background: creative.accent }} />
      <span className="art-eyebrow" style={{ background: creative.accent }}>{creative.eyebrow}</span>
      <strong>{headline}</strong>
      <div className="art-footer"><span>{creative.body}</span><small>POSTVMESTE · {slide + 1}</small></div>
    </div>
  );
}
