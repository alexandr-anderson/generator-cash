# Brand Guidelines v1.0

> Last updated: 2026-09-01
> Status: Draft
> Studio brand: postvmeste

## Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | #FF5C35 |
| Secondary Color | #C6F36B |
| Accent Color | #181816 |
| Primary Font | Arial |
| Voice | Прямой, дружелюбный, уверенный |

---

## 1. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary | #FF5C35 | rgb(255,92,53) | CTAs, логотип-плашка, акценты студии |
| Primary Dark | #181816 | rgb(24,24,22) | Текст, тёмный сайдбар |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Secondary | #C6F36B | rgb(198,243,107) | Подсветка, lime-акцент |
| Soft Accent | #FFF0E8 | rgb(255,240,232) | Мягкая подложка к primary |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Background | #FBFAF6 | rgb(251,250,246) | Paper, фон приложения |
| Surface | #FFFFFF | rgb(255,255,255) | Карточки, панели |
| Text Primary | #181816 | rgb(24,24,22) | Заголовки и основной текст |
| Text Secondary | #72716C | rgb(114,113,108) | Подписи, muted |
| Border | #E8E5DD | rgb(232,229,221) | Линии, разделители |

### Semantic Colors

| State | Hex | Usage |
|-------|-----|-------|
| Success | #22C55E | Подтверждения |
| Warning | #F59E0B | Осторожность |
| Error | #EF4444 | Ошибки |
| Info | #3B82F6 | Подсказки |

### Accessibility

- Text on paper (#181816 on #FBFAF6): high contrast, WCAG AAA for body text
- Primary on white: check CTA labels; dark text on coral if needed
- All interactive studio controls must stay readable on mobile

---

## 2. Typography

### Font Stack

```css
--font-heading: 'Arial', Helvetica, sans-serif;
--font-body: 'Arial', Helvetica, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale

| Element | Size (Desktop) | Size (Mobile) | Weight | Line Height |
|---------|----------------|---------------|--------|-------------|
| H1 | 48px | 32px | 700 | 1.2 |
| H2 | 36px | 28px | 600 | 1.25 |
| H3 | 28px | 24px | 600 | 1.3 |
| Body | 16px | 16px | 400 | 1.5 |
| Caption | 12px | 12px | 400 | 1.4 |

---

## 3. Logo Usage

### Variants

| Variant | File | Use Case |
|---------|------|----------|
| Wordmark | sidebar `.logo` | Навигация студии |
| Mark | повёрнутый квадрат с буквой | Иконка рядом с названием |

### Don'ts

- Don't stretch or rotate the mark beyond the slight studio tilt
- Don't replace coral (#FF5C35) with a client palette inside the product chrome
- Don't put the mark on a busy photo without a solid plate

---

## 4. Voice & Tone

### Brand Personality

| Trait | Description |
|-------|-------------|
| **Voice** | Прямой, дружелюбный, уверенный |
| **Composition** | Крупный заголовок, асимметрия, один фокус |
| **Density** | До 8 слов на обложке, много воздуха |
| **Imagery** | Портреты, предметные детали, мягкий свет |

### Core Attributes

| Attribute | Description |
|-----------|-------------|
| **Evidence-backed** | Признаки Brand DNA опираются на загруженные референсы |
| **Creator-first** | Интерфейс для соло-креаторов, не для агентств |
| **Local-first MVP** | Без отправки файлов третьим сторонам в deterministic режиме |

### Voice Chart

| Trait | We Are | We Are Not |
|-------|--------|------------|
| Прямой | Короткие ясные формулировки | Корпоративный канцелярит |
| Дружелюбный | Рядом с автором | Панибратство и сленг ради сленга |
| Уверенный | Спокойная экспертиза | Обещания «взорвём охваты» |

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Studio UI | Спокойный, конкретный | «Проверьте Brand DNA перед генерацией» |
| Creative headline | Смелый тезис | «5 ошибок личного бренда» |
| Errors | Без паники | «Файл не подошёл. Нужен PNG, JPEG или WEBP» |

### Prohibited Terms

| Avoid | Reason |
|-------|--------|
| Шаблонный инфобизнес | Против голоса студии |
| Гарантия результата | Нельзя обещать без фактов |
| Revolutionary | Пустой англицизм |
| Seamless | Шаблонный AI-текст |

### Summary

Тёплый экспертный визуальный язык: смелые заголовки, живой ритм и много воздуха. Сложное объясняется просто, без ощущения шаблонного контента.

---

## 5. Imagery Guidelines

### Photography Style

- Портреты, предметные детали, мягкий свет
- Композиция: крупный заголовок, асимметрия, один фокус
- Плотность текста: до 8 слов на обложке

### Visual Don'ts

| Avoid | Reason |
|-------|--------|
| Generic AI purple gradients | Ломает Brand DNA |
| Больше 8–12 слов на обложке | Теряется читаемость в Reels |
| Клиентская палитра в chrome студии | Путает продукт и бренд автора |

---

## AI Image Generation

### Base Prompt Template

```
postvmeste creator studio. Warm expert visual language, bold headlines, airy layouts. Palette #FF5C35, #C6F36B, #FBFAF6, #181816. Direct friendly confident voice. One focal point, large type, soft light portraits or object details.
```

### Style Keywords

| Category | Keywords |
|----------|----------|
| **Lighting** | soft light, warm, natural |
| **Mood** | expert, calm, confident |
| **Composition** | large headline, asymmetry, one focus |
| **Treatment** | airy, high contrast type, paper texture |
| **Aesthetic** | editorial, creator-studio, not generic SaaS |

### Visual Mood Descriptors

- Тёплый экспертный
- Смелый заголовок и воздух
- Без шаблонного AI-глянца

### Visual Don'ts

| Avoid | Reason |
|-------|--------|
| Purple mesh gradients | LLM-default slop |
| Centered three-card SaaS hero | Не про этот продукт |
| Dense walls of text on 9:16 | Не читается в Reels |

### Example Prompts

**Hero Banner:**
```
Editorial creator-studio still life, coral #FF5C35 accent, paper #FBFAF6, lime spark #C6F36B, large confident headline, lots of negative space
```

**Social Media Post:**
```
4:5 post cover, one thesis in 8 words, warm expert tone, portrait crop or object detail, palette #FF5C35 #FBFAF6 #181816
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-09-01 | Initial postvmeste studio guidelines |
