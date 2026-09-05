import type { SlideContent } from "@/lib/types";

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
        {slide?.text?.slice(0, 50) || topic}
      </span>
    </div>
  );
}
