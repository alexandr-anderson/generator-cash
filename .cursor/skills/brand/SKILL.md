---
name: brand
description: Universal Brand DNA from user-uploaded references. Use when extracting a visual/voice profile from reference images, adapting palette and traits to those files, and producing Reels/Post/Carousel content in that language. Triggers: Brand DNA, референсы, палитра из картинок, стиль автора, генерация в стиле загруженных материалов.
---

# Brand DNA

Универсальный инструмент студии: **референсы пользователя → Brand DNA → контент**. Не подставляй палитру postvmeste и не используй `docs/brand-guidelines.md` как бренд автора.

Движок в коде: `src/lib/brand-analysis.ts`, чтение картинок в браузере: `src/lib/reference-signals.ts`, сборка макетов: `src/lib/creative.ts`.

## Пайплайн

1. Пользователь загружает 1–20 своих PNG/JPEG/WEBP.
2. Считай пиксели референсов (доминантные цвета, тепло/холод, контраст, пропорции кадра). Имена файлов — только доп. evidence, не источник палитры.
3. Собери `StyleProfile`: имя, summary, 4 цвета (accent, secondary, paper, ink), признаки `voice` / `composition` / `density` / `imagery` с evidence.
4. Покажи профиль на шаге Brand DNA. Пользователь правит и утверждает. Не утверждай за него.
5. После брифа генерируй контент **только** из утверждённого профиля: цвета, голос, плотность текста, композиция макета.

## Правила

- Разные референсы → разный профиль. Не копируй один и тот же «тёплый экспертный» текст.
- Нет пикселей → нейтральная палитра и честно напиши, что изображения не прочитаны.
- Chrome студии (`src/app/globals.css`) не менять под клиента.
- Исходники не отправлять третьим сторонам в local-demo.

## Контракт `StyleProfile`

| Поле | Смысл в контенте |
| --- | --- |
| `colors[0]` | акцент обложки |
| `colors[1]` | второй акцент |
| `colors[2]` | фон |
| `colors[3]` | текст |
| `voice` | тон заголовка и eyebrow |
| `composition` | poster / band / centered |
| `density` | длина текста на слайдах |
| `imagery` | мотивы и rationale |
| `approved` | можно генерировать |

## Скрипты

Из корня репозитория, на вход — **профиль пользователя**, не бренд продукта:

```bash
# StyleProfile → текст для промпта
node .cursor/skills/brand/scripts/inject-brand-context.cjs --profile path/to/profile.json

# StyleProfile → markdown гайдлайны автора (не docs/brand-guidelines.md)
node .cursor/skills/brand/scripts/from-style-profile.cjs path/to/profile.json --out .brand/user-guidelines.md

# Сверить готовый файл с палитрой профиля
node .cursor/skills/brand/scripts/extract-colors.cjs --palette
node .cursor/skills/brand/scripts/validate-asset.cjs <asset-path>
```

`extract-colors.cjs --palette` читает `docs/brand-guidelines.md` только если это продукт студии. Для автора передай его гайдлайны: `--brand-file .brand/user-guidelines.md`.

## Справки по методологии

Читай по задаче, не все сразу: `references/voice-framework.md`, `visual-identity.md`, `color-palette-management.md`, `approval-checklist.md`.
