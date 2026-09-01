---
name: brand
description: Brand DNA, voice, visual identity, and guidelines for postvmeste studio creatives. Use when defining or updating a brand, reviewing tone of voice, palette, logo usage, StyleProfile, brand-guidelines.md, or checking creative assets against brand rules.
---

# Brand

Рабочий скилл бренда для этой студии. Источник правды — `docs/brand-guidelines.md`. В продукте тот же смысл живёт в `StyleProfile` (`src/lib/types.ts`): имя, summary, палитра, признаки с evidence.

## Когда применять

- Голос, тон, запрещённые формулировки
- Палитра, типографика, логотип, imagery
- Сверка креатива (Reels / Post / Carousel) с Brand DNA
- Обновление гайдлайнов и синхронизация токенов
- Подготовка бренда пользователя к генерации в студии

## Контракт студии

`StyleProfile` ↔ гайдлайны:

| StyleProfile | Гайдлайны |
| --- | --- |
| `name` | название бренда |
| `summary` | голос и характер |
| `colors[0]` | primary / accent |
| `colors[1]` | secondary |
| `colors[2]` | фон / paper |
| `colors[3]` | текст / ink |
| `traits` id `voice` | Voice & Tone |
| `traits` id `composition` | композиция обложек |
| `traits` id `density` | лимит слов на обложке |
| `traits` id `imagery` | Imagery Guidelines |
| `approved` | бренд можно отправлять в генерацию |

Код: `src/lib/types.ts`, `src/lib/brand-analysis.ts`, шаг «Brand DNA» в `src/components/studio-app.tsx`.

Не выдумывай признаки без evidence. Не утверждай бренд за пользователя.

## Быстрый старт

Скрипты запускать из корня репозитория.

```bash
# Контекст бренда для промпта или JSON
node .cursor/skills/brand/scripts/inject-brand-context.cjs
node .cursor/skills/brand/scripts/inject-brand-context.cjs --json

# StyleProfile JSON → docs/brand-guidelines.md
node .cursor/skills/brand/scripts/from-style-profile.cjs path/to/profile.json

# Палитра из гайдлайнов
node .cursor/skills/brand/scripts/extract-colors.cjs --palette

# Проверка имени/размера/формата файла
node .cursor/skills/brand/scripts/validate-asset.cjs <asset-path>

# Гайдлайны → assets/design-tokens.json и .css
node .cursor/skills/brand/scripts/sync-brand-to-tokens.cjs
```

Если `docs/brand-guidelines.md` нет — скопируй `templates/brand-guidelines-starter.md` или сгенерируй из профиля.

## Обновить бренд

1. Спроси у пользователя имя, primary/secondary/accent (hex), голос, mood. Не используй несуществующие инструменты вроде `AskUserQuestion`.
2. Запиши значения в `docs/brand-guidelines.md` (шаблон: `references/brand-guideline-template.md`, детали: `references/update.md`).
3. Синхронизируй токены скриптом выше.
4. Проверь: `node .cursor/skills/brand/scripts/inject-brand-context.cjs --json`

Для бренда **пользователя студии** правь StyleProfile в коде/данных студии, затем при необходимости пересобери гайдлайны через `from-style-profile.cjs`. Продуктовый UI postvmeste (`src/app/globals.css`) не подменяй палитрой клиентского бренда.

## Справки

| Тема | Файл |
| --- | --- |
| Обновление | `references/update.md` |
| Голос | `references/voice-framework.md` |
| Визуал | `references/visual-identity.md` |
| Сообщения | `references/messaging-framework.md` |
| Цвет | `references/color-palette-management.md` |
| Типографика | `references/typography-specifications.md` |
| Логотип | `references/logo-usage-rules.md` |
| Ассеты | `references/asset-organization.md` |
| Согласование | `references/approval-checklist.md` |
| Консистентность | `references/consistency-checklist.md` |

Читай справку только по текущей задаче, не грузи все сразу.
