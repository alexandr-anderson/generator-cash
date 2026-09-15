/**
 * Поля работы из тела запроса — общие для создания и обновления (`/api/works`).
 * Формат и рубрика сюда не входят: у созданной работы они не меняются.
 */
export function workFields(work: Record<string, unknown>) {
  return {
    topic: String(work.topic || "Без темы"),
    slides: (work.slides ?? []) as object,
    caption: String(work.caption || ""),
    hashtags: (work.hashtags ?? []) as object,
    reelScript: typeof work.reelScript === "string" ? work.reelScript : null,
    layout: String(work.layout || "poster"),
    background: String(work.background || "#f6f1e9"),
    accent: String(work.accent || "#ff5c35"),
    foreground: String(work.foreground || "#191817"),
    eyebrow: String(work.eyebrow || ""),
    brandLabel: String(work.brandLabel || "postvmeste"),
  };
}
