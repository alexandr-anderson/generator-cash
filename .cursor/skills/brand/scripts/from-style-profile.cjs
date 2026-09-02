#!/usr/bin/env node
/**
 * from-style-profile.cjs
 *
 * Convert a studio StyleProfile JSON into brand-guidelines.md.
 *
 * Usage:
 *   node from-style-profile.cjs <profile.json> [--out docs/brand-guidelines.md]
 *
 * Reads stdin when the path is "-" .
 */

const fs = require("fs");
const path = require("path");

function trait(profile, id, fallback = "") {
  const found = (profile.traits || []).find((item) => item.id === id);
  return (found && found.value ? String(found.value).trim() : "") || fallback;
}

function hex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^#?[0-9A-Fa-f]{6}$/);
  if (!match) return fallback;
  return value.startsWith("#") ? value.toUpperCase() : `#${value.toUpperCase()}`;
}

function rgb(hexValue) {
  const n = parseInt(hexValue.slice(1), 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

function render(profile) {
  const name = (profile.name || "Бренд").trim();
  const summary =
    (profile.summary || "Голос и визуальный язык ещё не описаны.").trim();
  const colors = Array.isArray(profile.colors) ? profile.colors : [];
  const primary = hex(colors[0], "#FF5C35");
  const secondary = hex(colors[1], "#C6F36B");
  const paper = hex(colors[2], "#FBFAF6");
  const ink = hex(colors[3], "#181816");
  const voice = trait(profile, "voice", "Прямой, дружелюбный, уверенный");
  const composition = trait(
    profile,
    "composition",
    "Крупный заголовок, асимметрия, один фокус",
  );
  const density = trait(profile, "density", "До 8 слов на обложке, много воздуха");
  const imagery = trait(
    profile,
    "imagery",
    "Портреты, предметные детали, мягкий свет",
  );
  const approved = profile.approved === true ? "Approved" : "Draft";
  const today = new Date().toISOString().slice(0, 10);

  return `# Brand Guidelines v1.0

> Last updated: ${today}
> Status: ${approved}
> Studio brand: ${name}

## Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | ${primary} |
| Secondary Color | ${secondary} |
| Accent Color | ${ink} |
| Primary Font | Arial |
| Voice | ${voice} |

---

## 1. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary | ${primary} | ${rgb(primary)} | CTAs, акценты, обложки Reels |
| Primary Dark | ${ink} | ${rgb(ink)} | Текст, тёмный фон |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Secondary | ${secondary} | ${rgb(secondary)} | Подсветка, второй акцент |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Background | ${paper} | ${rgb(paper)} | Фон креатива и paper |
| Text Primary | ${ink} | ${rgb(ink)} | Заголовки и основной текст |
| Text Secondary | #72716C | rgb(114,113,108) | Подписи, muted |
| Border | #E8E5DD | rgb(232,229,221) | Линии, разделители |

### Semantic Colors

| State | Hex | Usage |
|-------|-----|-------|
| Success | #22C55E | Подтверждения |
| Warning | #F59E0B | Осторожность |
| Error | #EF4444 | Ошибки |
| Info | #3B82F6 | Подсказки |

---

## 2. Typography

### Font Stack

\`\`\`css
--font-heading: 'Arial', Helvetica, sans-serif;
--font-body: 'Arial', Helvetica, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
\`\`\`

## 3. Voice & Tone

### Brand Personality

| Trait | Description |
|-------|-------------|
| **Voice** | ${voice} |
| **Composition** | ${composition} |
| **Density** | ${density} |
| **Imagery** | ${imagery} |

### Summary

${summary}

### Prohibited Terms

| Avoid | Reason |
|-------|--------|
| Шаблонный инфобизнес | Против голоса студии |
| Гарантия результата | Нельзя обещать без фактов |

## 4. Imagery Guidelines

### Photography Style

- ${imagery}
- Композиция: ${composition}
- Плотность текста: ${density}

## AI Image Generation

### Base Prompt Template

\`\`\`
${name}. ${summary} Palette ${primary}, ${secondary}, ${paper}, ${ink}. ${voice}. ${composition}. ${imagery}.
\`\`\`

### Style Keywords

| Category | Keywords |
|----------|----------|
| **Mood** | ${voice} |
| **Composition** | ${composition} |
| **Treatment** | ${density} |
| **Imagery** | ${imagery} |

### Visual Mood Descriptors

- ${voice}
- ${composition}
- ${imagery}

### Visual Don'ts

| Avoid | Reason |
|-------|--------|
| Generic AI purple gradients | Ломает Brand DNA |
| Больше 8–12 слов на обложке | ${density} |
`;
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
  const inputPath = args.find(
    (arg, index) => !arg.startsWith("--") && args[index - 1] !== "--out",
  );

  if (!inputPath) {
    console.error(
      "Usage: node from-style-profile.cjs <profile.json|-> [--out .brand/user-guidelines.md]",
    );
    process.exit(1);
  }

  const raw =
    inputPath === "-"
      ? fs.readFileSync(0, "utf-8")
      : fs.readFileSync(
          path.isAbsolute(inputPath)
            ? inputPath
            : path.join(process.cwd(), inputPath),
          "utf-8",
        );

  let profile;
  try {
    profile = JSON.parse(raw);
  } catch (error) {
    console.error("Invalid StyleProfile JSON:", error.message);
    process.exit(1);
  }

  const markdown = render(profile);
  if (!outPath) {
    process.stdout.write(markdown);
    return;
  }
  const resolvedOut = path.isAbsolute(outPath)
    ? outPath
    : path.join(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, markdown);
  console.log(`Wrote ${path.relative(process.cwd(), resolvedOut) || resolvedOut}`);
}

main();
