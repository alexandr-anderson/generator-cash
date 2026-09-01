---
name: visual-motion
description: Implement richer visuals and animation on the static FILO site with CSS-first motion, reduced-motion, and browser QA. Use when coding the redesign look, scroll effects, hover, or GSAP.
---

Внедряй визуал и анимацию **на русском в комментариях к пользователю**. Стек: статические страницы (`index.html`, `catalog.html`, `about.html`, `delivery.html`), [src/styles/main.css](src/styles/main.css), [src/js/app.js](src/js/app.js). Не переводить сайт на React/Webflow.

Сначала прочитай moodboard-контракт (`design-references`) и тексты (`conversion-copy`), если они уже согласованы. Не ломай B2B-иерархию, Telegram-заказ и корзину.

## Приоритет технологий

1. **CSS** — transitions, `@keyframes`, `animation-timeline` / scroll-driven где уместно и поддерживается, `content-visibility` осторожно.
2. Обязательно `@media (prefers-reduced-motion: reduce)`: отключить параллакс, длинные reveal, smooth-scroll-библиотеки; оставить мгновенные состояния.
3. **GSAP / Lenis / Anime** — только если CSS не закрывает согласованный уровень motion и пользователь (или контракт) это разрешил. Одна библиотека предпочтительнее трёх. Подключай осознанно (вес, CDN vs npm).
4. Не добавляй тяжёлый 3D/WebGL «для wow», если это не было must в контракте.

## Что усложнять визуально (типично)

- Hero: глубина (слои, мягкий slider, не десять конкурирующих CTA).
- Карточки каталога: hover, тень, порядок фото; фильтры остаются понятными.
- Header / top-bar: аккуратный scroll-state, не прыжки layout.
- Секции: чередование фона, ритм отступов, не «все блоки одинаковые».

## Что не ломать

- `data-telegram`, корзина, счётчик «В корзину», фильтры каталога.
- Читаемость на мобильном: motion не перекрывает кнопки и текст.
- Производительность: не анимируй `top/left` толпой; предпочитай `transform` и `opacity`.

## QA (после правок, computerUse если доступен)

Чеклист:

- [ ] Главная: hero, trust-bar, CTA в Telegram/каталог
- [ ] Каталог: сетка, карточка, фильтры
- [ ] Корзина / кнопка корзины в header
- [ ] Header на скролле, мобильное меню
- [ ] `prefers-reduced-motion` (хотя бы mentally / DevTools)
- [ ] Нет CLS от шрифтов и слайдера, критичные клики не «уезжают»

## Связка

Направление — `design-direction`. Примеры — `design-references`. Воронка — `landing-page-audit`. Тексты — `conversion-copy`. SEO — `seo-local`.

## Триггеры

«анимация», «motion», «GSAP», «посложнее визуал», «scroll reveal», «параллакс», «внедри новый дизайн».
