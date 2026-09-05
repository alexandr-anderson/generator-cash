import type { CreativeWork } from "./types";
import { FORMAT_SIZES } from "./types";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (c) => {
    const map: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
    return map[c] ?? c;
  });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

export function slideToSvg(work: CreativeWork, slideIndex: number): string {
  const { width, height } = FORMAT_SIZES[work.format];
  const slide = work.slides[slideIndex];
  if (!slide) return "";

  const lines = wrapText(slide.text, work.layout === "centered" ? 16 : 22);
  const fontSize = slide.fontSize || 48;
  const fg = slide.textColor || work.foreground;
  const eyebrow = escapeXml(work.eyebrow.toUpperCase());
  const brand = escapeXml(work.brandLabel || "POSTVMESTE");

  if (work.layout === "centered") {
    const textBlock = lines.map((l, i) =>
      `<text x="${width / 2}" y="${height * 0.42 + i * (fontSize + 16)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-2" fill="${fg}">${escapeXml(l)}</text>`
    ).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${work.background}"/>
  <circle cx="${width / 2}" cy="${height * 0.2}" r="${width * 0.15}" fill="${work.accent}" opacity="0.9"/>
  <text x="${width / 2}" y="${height * 0.21}" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="${fg}">${eyebrow}</text>
  ${textBlock}
  <text x="${width / 2}" y="${height - 120}" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="600" fill="${fg}">${escapeXml(work.slides[work.slides.length - 1]?.text === slide.text ? "→" : "")}</text>
  <text x="${width / 2}" y="${height - 70}" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="${fg}" opacity="0.5">${brand} · ${slideIndex + 1}</text>
</svg>`;
  }

  if (work.layout === "band") {
    const bandH = Math.round(height * 0.16);
    const textBlock = lines.map((l, i) =>
      `<text x="72" y="${height * 0.3 + i * (fontSize + 16)}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-3" fill="${fg}">${escapeXml(l)}</text>`
    ).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${work.background}"/>
  <rect width="${width}" height="${bandH}" fill="${work.accent}"/>
  <text x="72" y="${Math.round(bandH * 0.65)}" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="${fg}">${eyebrow}</text>
  ${textBlock}
  <line x1="72" y1="${height - 180}" x2="${width - 72}" y2="${height - 180}" stroke="${fg}" stroke-width="2" opacity="0.25"/>
  <text x="72" y="${height - 110}" font-family="Arial,sans-serif" font-size="28" font-weight="600" fill="${fg}">${brand}</text>
  <text x="${width - 72}" y="${height - 110}" text-anchor="end" font-family="Arial,sans-serif" font-size="22" fill="${fg}" opacity="0.5">${slideIndex + 1}</text>
</svg>`;
  }

  const textBlock = lines.map((l, i) =>
    `<text x="72" y="${height * 0.38 + i * (fontSize + 18)}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-3" fill="${fg}">${escapeXml(l)}</text>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${work.background}"/>
  <circle cx="${width * 0.85}" cy="${height * 0.12}" r="${width * 0.28}" fill="${work.accent}" opacity="0.9"/>
  <rect x="72" y="72" width="220" height="48" rx="24" fill="${work.accent}"/>
  <text x="182" y="104" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="${fg}">${eyebrow}</text>
  ${textBlock}
  <line x1="72" y1="${height - 180}" x2="${width - 72}" y2="${height - 180}" stroke="${fg}" stroke-width="2" opacity="0.25"/>
  <text x="72" y="${height - 110}" font-family="Arial,sans-serif" font-size="28" font-weight="600" fill="${fg}">${brand}</text>
  <text x="${width - 72}" y="${height - 110}" text-anchor="end" font-family="Arial,sans-serif" font-size="22" fill="${fg}" opacity="0.5">${slideIndex + 1}</text>
</svg>`;
}

export async function reelCoverToPngBlob(work: CreativeWork): Promise<Blob> {
  const slide = work.slides[0];
  if (!slide) throw new Error("No reel slide");
  const { width, height } = FORMAT_SIZES.reel;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");

  ctx.fillStyle = work.background || "#191817";
  ctx.fillRect(0, 0, width, height);

  if (slide.imageUrl) {
    const bitmap = await loadCoverBitmap(slide.imageUrl);
    drawCoverImage(ctx, bitmap, width, height);
  }

  const hook = slide.text.trim();
  if (hook) {
    const fontSize = slide.fontSize || 64;
    const lines = wrapText(hook, 16);
    const lineHeight = fontSize + 14;
    const boxWidth = Math.round(width * 0.78);
    const boxHeight = lines.length * lineHeight + 56;
    const boxX = Math.round((width - boxWidth) / 2);
    const boxY = Math.round(height / 2 - boxHeight / 2);
    ctx.fillStyle = work.accent || "rgba(17,17,17,0.72)";
    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 28);
    ctx.fill();
    ctx.fillStyle = slide.textColor || "#ffffff";
    ctx.font = `800 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((line, index) => {
      const y = boxY + 28 + lineHeight * index + lineHeight / 2;
      ctx.fillText(line, width / 2, y, boxWidth - 48);
    });
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG export failed");
  return blob;
}

async function loadCoverBitmap(url: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("export");
  return createImageBitmap(await response.blob());
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export async function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("No canvas")); }
      ctx.drawImage(image, 0, 0);
      canvas.toBlob((result) => {
        URL.revokeObjectURL(url);
        if (result) { resolve(result); } else { reject(new Error("PNG export failed")); }
      }, "image/png");
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG load failed")); };
    image.src = url;
  });
}
