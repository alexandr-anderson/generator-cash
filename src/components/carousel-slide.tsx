import { carouselSlideRole } from "@/lib/render";
import type { CreativeWork } from "@/lib/types";

export function CarouselSlideFace({
  work,
  slideIndex,
  compact = false,
}: {
  work: CreativeWork;
  slideIndex: number;
  compact?: boolean;
}) {
  const slide = work.slides[slideIndex];
  if (!slide) return null;

  const role = carouselSlideRole(slideIndex, work.slides.length);
  const inverted = role === "closer" && work.layout !== "band";
  const background = inverted ? work.accent : work.background;
  const color = inverted ? work.foreground : (slide.textColor || work.foreground);
  const fontSize = compact ? 7 : Math.round((slide.fontSize || 48) * 0.6);

  return (
    <div
      className={`slide-preview layout-${work.layout} role-${role}${compact ? " is-compact" : ""}`}
      style={{ background, color }}
    >
      {work.layout === "poster" && role !== "closer" && (
        <div className="slide-accent-circle" style={{ background: work.accent }} />
      )}
      {work.layout === "band" && role === "cover" && (
        <div className="slide-band-top" style={{ background: work.accent }} />
      )}
      {work.layout === "band" && role === "body" && (
        <div className="slide-band-rail" style={{ background: work.accent }} />
      )}
      {work.layout === "centered" && role === "cover" && (
        <div className="slide-accent-dot" style={{ background: work.accent }} />
      )}
      {work.layout === "band" && role === "closer" && (
        <div className="slide-closer-panel" style={{ background: work.accent }} />
      )}
      {work.layout === "centered" && role === "closer" && (
        <div className="slide-accent-dot slide-accent-dot-closer" style={{ background: work.background }} />
      )}
      {role === "body" && (
        <span className="slide-index">{String(slideIndex + 1).padStart(2, "0")}</span>
      )}
      <strong className="slide-headline" style={{ fontSize }}>
        {slide.text || "..."}
      </strong>
      {!compact && (
        <div className="slide-footer">
          <span>{work.brandLabel}</span>
          <span>{slideIndex + 1}</span>
        </div>
      )}
    </div>
  );
}
