export function captionTxt(input: { caption?: string; hashtags?: string[] }) {
  const caption = (input.caption || "").trim();
  const tags = (input.hashtags || [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(" ");
  return [caption, tags].filter(Boolean).join("\n\n");
}

export function textFileBlob(text: string) {
  return new Blob([`\uFEFF${text}`], { type: "text/plain;charset=utf-8" });
}
