import type { SlideContent } from "@/lib/types";

/**
 * Текст резался ровно по 50-му символу, посреди слова и без многоточия: в ленте
 * работ обрывок вроде «Как перестать бояться холодных звонк» читался как битая работа.
 */
function clamp(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}

export function WorkThumb({
  slide,
  topic,
  background,
  className,
}: {
  slide?: SlideContent | null;
  topic?: string;
  background?: string;
  className?: string;
}) {
  if (slide?.imageUrl) {
    return (
      <div className={`work-thumb ${className || ""}`}>
        <img src={slide.imageUrl} alt="" />
      </div>
    );
  }

  return (
    <div className={`work-thumb ${className || ""}`} style={{ background }}>
      <span style={{ color: slide?.textColor || "#fff" }}>
        {slide?.text ? clamp(slide.text, 50) : topic}
      </span>
    </div>
  );
}
