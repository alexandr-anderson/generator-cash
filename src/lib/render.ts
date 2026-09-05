import type { CarouselRecipe } from "./carousel-recipe";
import { recipeForWork } from "./carousel-recipe";
import type { CreativeWork } from "./types";
import { FORMAT_SIZES } from "./types";

export type CarouselSlideRole = "cover" | "body" | "closer";

export function carouselSlideRole(index: number, total: number): CarouselSlideRole {
  if (index <= 0) return "cover";
  if (total > 1 && index === total - 1) return "closer";
  return "body";
}

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

  const recipe = recipeForWork(work);
  const role = carouselSlideRole(slideIndex, work.slides.length);
  const inverted = role === "closer" && recipe.closer === "accent";
  const fill = inverted ? work.accent : work.background;
  const fg = inverted ? work.foreground : (slide.textColor || work.foreground);
  const align = recipe.align;
  const lines = wrapText(slide.text, align === "center" ? 16 : 22);
  const fontSize = slide.fontSize || 48;
  const brand = escapeXml(work.brandLabel || "postvmeste");
  const decor = layoutDecor(recipe, role, width, height, work.accent, work.background);
  const indexLabel = String(slideIndex + 1).padStart(2, "0");
  const textY = role === "closer" && recipe.closer === "split"
    ? height * 0.68
    : role === "body"
      ? height * ((recipe.textY + 8) / 100)
      : height * (recipe.textY / 100);
  const textX = align === "center" ? width / 2 : 72;
  const textBlock = svgTextBlock(lines, {
    x: textX,
    y: textY,
    fontSize,
    fill: fg,
    anchor: align === "center" ? "middle" : "start",
  });
  const number = role === "body" && recipe.showIndex
    ? `<text x="${textX}" y="${height * 0.2}" text-anchor="${align === "center" ? "middle" : "start"}" font-family="Arial,sans-serif" font-size="72" font-weight="800" fill="${work.accent}" opacity="0.85">${indexLabel}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${fill}"/>
  ${decor}
  ${number}
  ${textBlock}
  ${svgFooter(width, height, brand, slideIndex + 1, fg, align === "center")}
</svg>`;
}

function layoutDecor(
  recipe: CarouselRecipe,
  role: CarouselSlideRole,
  width: number,
  height: number,
  accent: string,
  paper: string,
) {
  if (role === "closer") {
    if (recipe.closer === "split") {
      const panelY = Math.round(height * 0.58);
      return `<rect y="${panelY}" width="${width}" height="${height - panelY}" fill="${accent}"/>`;
    }
    if (recipe.family === "centered") {
      return `<circle cx="${width / 2}" cy="${height * 0.42}" r="${width * 0.28}" fill="${paper}" opacity="0.2"/>`;
    }
    return "";
  }
  const decor = role === "body" && recipe.decor === "blob" ? "blob" : role === "body" && recipe.decor === "band-top" ? "rail" : recipe.decor;
  const cx = (recipe.decorX / 100) * width;
  const cy = (recipe.decorY / 100) * height;
  const scale = recipe.decorScale;
  if (decor === "none" || (role === "body" && decor === "dot")) return "";
  if (decor === "band-top") {
    return `<rect width="${width}" height="${Math.round(height * 0.14 * scale)}" fill="${accent}"/>`;
  }
  if (decor === "rail") {
    return `<rect width="${Math.round(18 * scale)}" height="${height}" fill="${accent}"/>`;
  }
  const radius = (decor === "dot" ? width * 0.13 : role === "body" ? width * 0.18 : width * 0.28) * scale;
  const opacity = role === "body" ? 0.45 : 0.9;
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${accent}" opacity="${opacity}"/>`;
}

function svgTextBlock(
  lines: string[],
  opts: { x: number; y: number; fontSize: number; fill: string; anchor: "start" | "middle" },
) {
  const lineH = opts.fontSize + 16;
  return lines.map((line, i) =>
    `<text x="${opts.x}" y="${opts.y + i * lineH}" text-anchor="${opts.anchor}" font-family="Arial,sans-serif" font-size="${opts.fontSize}" font-weight="800" letter-spacing="-2" fill="${opts.fill}">${escapeXml(line)}</text>`
  ).join("");
}

function svgFooter(
  width: number,
  height: number,
  brand: string,
  page: number,
  fill: string,
  centered: boolean,
) {
  if (centered) {
    return `<text x="${width / 2}" y="${height - 70}" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="${fill}" opacity="0.5">${brand} · ${page}</text>`;
  }
  return `
  <line x1="72" y1="${height - 180}" x2="${width - 72}" y2="${height - 180}" stroke="${fill}" stroke-width="2" opacity="0.25"/>
  <text x="72" y="${height - 110}" font-family="Arial,sans-serif" font-size="28" font-weight="600" fill="${fill}">${brand}</text>
  <text x="${width - 72}" y="${height - 110}" text-anchor="end" font-family="Arial,sans-serif" font-size="22" fill="${fill}" opacity="0.5">${page}</text>`;
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
