import { recipeForWork } from "@/lib/carousel-recipe";
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

  const recipe = recipeForWork(work);
  const role = carouselSlideRole(slideIndex, work.slides.length);
  const inverted = role === "closer" && recipe.closer === "accent";
  const background = inverted ? work.accent : work.background;
  const color = inverted ? work.foreground : (slide.textColor || work.foreground);
  const fontSize = compact ? 7 : Math.round((slide.fontSize || 48) * 0.6);
  const bodyDecor = role === "body" && recipe.decor === "band-top" ? "rail" : recipe.decor;

  return (
    <div
      className={`slide-preview layout-${recipe.family} role-${role} align-${recipe.align}${compact ? " is-compact" : ""}`}
      style={{
        background,
        color,
        paddingTop: role === "closer" ? undefined : `${Math.max(recipe.textY - 18, 8)}%`,
      }}
    >
      {role !== "closer" && bodyDecor === "blob" && (
        <div
          className="slide-accent-circle"
          style={{
            background: work.accent,
            top: `${recipe.decorY}%`,
            left: `${recipe.decorX}%`,
            right: "auto",
            transform: `translate(-50%, -50%) scale(${recipe.decorScale})`,
          }}
        />
      )}
      {role === "cover" && bodyDecor === "band-top" && (
        <div className="slide-band-top" style={{ background: work.accent, height: `${Math.round(14 * recipe.decorScale)}%` }} />
      )}
      {role !== "closer" && bodyDecor === "rail" && (
        <div className="slide-band-rail" style={{ background: work.accent }} />
      )}
      {role === "cover" && bodyDecor === "dot" && (
        <div
          className="slide-accent-dot"
          style={{
            background: work.accent,
            top: `${recipe.decorY}%`,
            left: `${recipe.decorX}%`,
            transform: `translate(-50%, -50%) scale(${recipe.decorScale})`,
          }}
        />
      )}
      {role === "closer" && recipe.closer === "split" && (
        <div className="slide-closer-panel" style={{ background: work.accent }} />
      )}
      {role === "closer" && recipe.family === "centered" && recipe.closer === "accent" && (
        <div className="slide-accent-dot slide-accent-dot-closer" style={{ background: work.background }} />
      )}
      {role === "body" && recipe.showIndex && (
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
