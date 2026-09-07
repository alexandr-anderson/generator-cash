export function captionTxt(input: { caption?: string; hashtags?: string[] }) {
  const caption = (input.caption || "").trim();
  const tags = (input.hashtags || [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(" ");
  return [caption, tags].filter(Boolean).join("\n\n");
}

export function reelScriptTxt(input: { reelScript?: string; slides?: { text?: string }[]; caption?: string }) {
  const script = (input.reelScript || "").trim();
  if (script) return script;
  return (input.slides?.[0]?.text || input.caption || "").trim();
}

export function textFileBlob(text: string) {
  return new Blob([`\uFEFF${text}`], { type: "text/plain;charset=utf-8" });
}
