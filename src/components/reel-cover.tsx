type ReelCoverProps = {
  imageUrl?: string;
  hook: string;
  background?: string;
  plaque?: string;
  textColor?: string;
  fontSize?: number;
};

export function ReelCover({
  imageUrl,
  hook,
  background = "#191817",
  plaque = "#191817",
  textColor = "#ffffff",
  fontSize = 22,
}: ReelCoverProps) {
  return (
    <div className="reel-cover" style={{ background }}>
      {imageUrl ? <img src={imageUrl} alt="" /> : null}
      {hook ? (
        <div className="reel-hook-safe">
          <span
            className="reel-hook"
            style={{ background: plaque, color: textColor, fontSize: `${fontSize}px` }}
          >
            {hook}
          </span>
        </div>
      ) : null}
    </div>
  );
}
