# Карта postvmeste.ru

Снимок студии на 8 сентября 2026. Собрано скиллами cartograph: `architecture-diagram`, `dependency-graph`, `workflow-diagram`, `data-flow`. Схемы смотреть в превью Markdown (GitHub / Cursor). Один холст «всё сразу» нечитаем — слои ниже.

Репозиторий: `generator-cash`. Прод: [postvmeste.ru](https://postvmeste.ru). Приложение: Next.js 16 standalone + Prisma/MySQL + PM2 на Timeweb, порт **3001**.

---

## 1. Где крутится система

Браузер не ходит в Node напрямую. Снаружи HTTPS, внутри Apache отдаёт PHP-прокси на `127.0.0.1:3001`.

```mermaid
flowchart LR
  Browser["Браузер"]
  Domain["postvmeste.ru"]
  Proxy["public_html PHP-прокси"]
  Next["Next standalone :3001"]
  PM2["PM2 postvmeste"]
  MySQL[("MySQL Prisma")]
  Disk[("uploads/ диск")]
  Resend["Resend почта"]
  TextAI["Шлюз текста"]
  ImageAI["Шлюз картинок"]
  TG["Telegram алерты"]
  GHA["GitHub Actions"]
  YK["ЮKassa — ещё нет"]

  Browser --> Domain --> Proxy --> Next
  PM2 --> Next
  Next ==> MySQL
  Next ==> Disk
  Next -.-> Resend
  Next -.-> TextAI
  Next -.-> ImageAI
  Next -.-> TG
  GHA -->|rsync и рестарт| PM2
  GHA -->|health каждые 5 мин| Domain
  YK -.-> Next
```

| Узел | Где в коде / на сервере |
| --- | --- |
| Next | `src/app/*`, `output: "standalone"` |
| PM2 | `ecosystem.config.cjs`, `APP_PORT=3001` |
| MySQL | `prisma/schema.prisma`, `DATABASE_URL` |
| Диск | `src/lib/storage.ts` → `uploads/{userId}/{uuid}.ext` |
| Текст AI | `src/lib/openai.ts` → `OPENAI_*`, модель по умолчанию `gpt-5.5` |
| Картинки AI | `OPENAI_IMAGE_*`, модель `gpt-image-2` |
| Почта | `src/lib/mail.ts`, Resend HTTPS |
| Алерты | `src/lib/alerts.ts` + `telegram.ts` → [@mr_anderson_say](https://t.me/mr_anderson_say) |
| Деплой | `.github/workflows/deploy.yml` → `/home/c/<SSH_USER>/postvmeste` |
| ЮKassa | нет в коде; `POST /api/usage/tier` отвечает **403** |

Dev: `localhost:3000`. Прод снаружи: `https://postvmeste.ru`.

---

## 2. Где что хранится

Два мира: **строки в MySQL** и **байты на диске**. Cookie сессии в браузере, в БД только хеш.

```mermaid
flowchart TD
  subgraph mysql[MySQL]
    User["User профиль и роль"]
    Consent["ConsentRecord"]
    Session["Session хеш cookie"]
    EmailTok["EmailToken 48ч"]
    ResetTok["PasswordReset 1ч"]
    Usage["UsageState лимит"]
    Rubric["Rubric + carouselRecipe"]
    Tpl["RubricTemplate"]
    Work["Work слайды JSON"]
    FileMeta["FileAsset метаданные"]
    User --> Consent
    User --> Session
    User --> Usage
    User --> Rubric
    User --> Work
    User --> FileMeta
    Rubric --> Tpl
  end

  subgraph disk[Диск сервера]
    Uploads["uploads/"]
    Backups["backups/ дампы"]
    EnvFile[".env секреты"]
  end

  subgraph browser[Браузер]
    Cookie["cookie pv_session"]
    Zip["ZIP на диск пользователя"]
  end

  FileMeta -->|"objectKey"| Uploads
  Cookie -->|"SHA-256"| Session
  EnvFile -.-> mysql
```

### Таблицы

| Модель | Что внутри |
| --- | --- |
| `User` | почта, хеш пароля, `emailVerifiedAt`, ниша/аудитория/тон, цвета, `logoFileId`, `role`, `bannedAt` |
| `ConsentRecord` | версия оферты (`LEGAL_VERSION`), дата согласия |
| `Session` | хеш токена, срок 30 дней |
| `EmailToken` | подтверждение почты, 48 часов |
| `PasswordReset` | сброс пароля, 1 час |
| `UsageState` | тариф, лимит в неделю, `generationsUsed`, `weekStartedAt`, **остаток стартовых бесплатных** (`initialFreeRemaining`, старт 5) |
| `Rubric` | имя, цвета, ссылка вдохновения, JSON **рецепта карусели** |
| `RubricTemplate` | раскладка/сценарий/декор на пару `(рубрика, формат)` |
| `Work` | формат, тема, `slides` JSON, подпись, хештеги, цвета; поле `reelScript` в БД ещё есть, в UI больше не пишем |
| `FileAsset` | kind: `logo` / `reference` / `photo` / `export`; путь `objectKey` |

Картинки поста и обложки после генерации тоже `FileAsset` kind `export`, отдаются как `/api/files/{id}`.

### Что не в MySQL

| Место | Что | Переживает ли деплой |
| --- | --- | --- |
| `uploads/` | байты файлов | да, rsync `--delete` его не трогает |
| `backups/` | дампы перед миграцией, до 7 штук | да, в exclude |
| `.env` на сервере | `DATABASE_URL`, Resend, `APP_URL`, `ADMIN_EMAILS` | да, в exclude |
| GitHub Secrets | SSH, ключи OpenAI и Telegram | не на диске приложения |
| Actions cache | `.uptime-state.json` | состояние «сайт уже алертили» |
| Браузер | ZIP экспорта, черновик флоу | нет |

Загрузка файла: PNG/JPEG/WEBP, до 8 МБ. Референс на рубрику сбрасывает `carouselRecipe`.

---

## 3. Зависимости модулей

Стрелка `A --> B` значит «A зависит от B». Внешние сервисы — пунктир.

```mermaid
flowchart LR
  subgraph ui[Экраны]
    Create["create-flow.tsx"]
    Store["store.tsx"]
    Dash["dashboard / archive / profile"]
    AdminUI["admin"]
  end

  subgraph api[API]
    Compose["/api/ai/compose"]
    Expand["/api/ai/expand"]
    TextAPI["/api/ai/text"]
    AuthAPI["/api/auth/*"]
    FilesAPI["/api/files"]
  end

  subgraph core[Ядро]
    Quota["quota.ts"]
    Copy["ai-copy.ts"]
    Image["ai-image.ts"]
    Gen["generate.ts"]
    Recipe["ensure-carousel-recipe.ts"]
    Auth["auth.ts"]
    Storage["storage.ts"]
    Alerts["alerts.ts"]
  end

  subgraph ext[Снаружи]
    OA["OpenAI текст"]
    OI["OpenAI картинки"]
    RS["Resend"]
    TG2["Telegram"]
    DB["Prisma/MySQL"]
  end

  Create ==> Store
  Store ==> Compose
  Store ==> Expand
  Store ==> TextAPI
  Compose ==> Copy
  Compose ==> Image
  Compose ==> Quota
  Expand ==> Copy
  Expand ==> Quota
  Image --> Storage
  Copy -.-> OA
  Image -.-> OI
  Recipe -.-> OA
  AuthAPI ==> Auth
  Auth --> DB
  Quota --> DB
  Storage --> DB
  Alerts -.-> TG2
  AuthAPI -.-> RS
  FilesAPI --> Storage
  Create --> Gen
```

Кластеры по папкам (без gauntlet, группировка по каталогам):

| Кластер | Папка | Зачем |
| --- | --- | --- |
| Создание | `src/components/create-flow.tsx`, `reel-cover`, `carousel-slide` | шаги и редактор |
| Студия | `src/lib/store.tsx`, `studio.ts`, `serializers.ts` | гидратация ЛК |
| Генерация | `ai-copy.ts`, `ai-image.ts`, `generate.ts`, `openai.ts` | текст, картинки, варианты |
| Квота и доступ | `quota.ts`, `auth.ts`, `http.ts`, `admin.ts` | лимит, сессия, админка |
| Файлы | `storage.ts`, `export-package.ts`, `render.ts` | диск и ZIP |
| Деньги | `billing.ts` | заглушка, смена тарифа закрыта |
| Деплой | `.github/workflows`, `scripts/*` | сборка, rsync, health |

Самые «толстые» узлы: `create-flow.tsx` (UI всего флоу), `ai-copy.ts` (все тексты модели), `quota.ts` (любое списание).

---

## 4. Путь пользователя

```mermaid
flowchart TD
  L([Лендинг /]) --> R[Регистрация /auth]
  R --> Consent{Галочка согласия?}
  Consent -->|нет| R
  Consent -->|да| Mail{Resend настроен?}
  Mail -->|прод без ключа| Fail503[503 регистрация закрыта]
  Mail -->|да| Verify["Письмо → /auth/verify"]
  Verify --> Login[Вход]
  Login --> Gate{Кто это?}
  Gate -->|бан| Ban[403 забанен]
  Gate -->|почта не подтверждена| Verify
  Gate -->|ок| Home["Главная /dashboard"]

  Home --> Create["Создать"]
  Home --> Arch["Архив"]
  Home --> Prof["Профиль"]
  Home --> Adm{"role admin?"}
  Adm -->|да| Admin["/admin"]
  Adm -->|нет| Home

  Create --> Q{Генерации > 0?}
  Q -->|нет| PayWall["Профиль: скоро оплата. Кассы нет"]
  Q -->|да| Flow[["Флоу создания"]]
```

Публичные страницы без входа: `/`, `/offer`, `/privacy`, `/support`, `/auth`, `/auth/verify`, `/auth/forgot`, `/auth/reset`.

ЛК без сессии → редирект на `/auth`. AI-роуты без подтверждённой почты → 403. Сессия с неподтверждённой почтой или баном сбрасывается.

После первой работы в архиве, если профиль не добит — попап «дополни профиль».

---

## 5. Этапы создания работы

Шаги в `create-flow.tsx`: `format → rubric → topic → variants → editor`.

```mermaid
flowchart TD
  S([Старт Создать]) --> Fmt{Формат?}
  Fmt --> Rubric[Рубрика]
  Rubric --> Topic["Тема, цвета, референсы"]
  Topic --> Help{"Помочь с текстом / хуки?"}
  Help -->|да| Draft["/api/ai/text без списания"]
  Draft --> Topic
  Topic --> Go["Создать /api/ai/compose"]
  Go --> Q0{Лимит > 0?}
  Q0 -->|нет| Stop[402 / кнопка в профиль]
  Q0 -->|да| Kind{Формат}

  Kind -->|пост| PostOK{Картинки ок?}
  PostOK -->|да| Pay1["Списать 1"]
  PostOK -->|нет| Retry1[Ещё раз, лимит цел]
  Pay1 --> Editor

  Kind -->|обложка| ReelCap{"Есть подпись / транскрипт / саммари?"}
  ReelCap -->|да| CapUser[Берём текст как есть]
  ReelCap -->|нет| CapAI[Подпись по хуку]
  CapUser --> CoverOK{Обложки ок?}
  CapAI --> CoverOK
  CoverOK -->|да| Pay2["Списать 1"]
  CoverOK -->|нет| Retry1
  Pay2 --> Editor

  Kind -->|карусель| Preview["3 крючка + рецепт, без списания"]
  Preview --> Pick[Выбор захода]
  Pick --> Seven["/api/ai/expand 7 слайдов"]
  Seven --> ExpOK{Успех?}
  ExpOK -->|да| Pay3["Списать 1 после семёрки"]
  ExpOK -->|нет| Retry2[Ещё раз expand, лимит цел]
  Pay3 --> Editor

  Editor --> Zip[["Экспорт ZIP"]]
```

### Разница форматов

| | Карусель | Пост | Обложка Reels |
| --- | --- | --- | --- |
| Списание на «Создать» | нет, только превью | после успеха | после успеха |
| Списание на expand | после 7 слайдов | — | — |
| Подпись | модель на expand | текст автора | свой текст или модель по хуку |
| Картинка | SVG кодом + рецепт | 3× `gpt-image-2` | 3× обложки 9:16 |
| ZIP | 7 PNG + `caption.txt` | `post.png` + `caption.txt` | `reel-cover.png` + `caption.txt` |
| Сценарий ролика | — | — | не даём |

«Помочь с текстом» / «Предложить хуки» лимит не ест. Ошибка модели → Telegram `generation`, списания нет.

---

## 6. Как тратится лимит

Стартовые 5 бесплатных тратятся первыми. На платном тарифе их остаток **складывается** с неделей.

```mermaid
flowchart TD
  Need([Нужна генерация]) --> Has{UsageState есть?}
  Has -->|нет| No[Отказать]
  Has -->|да| Starter{initialFreeRemaining > 0?}
  Starter -->|да| EatFree["Списать 1 из стартовых"]
  Starter -->|нет| Week{Неделя истекла?}
  Week -->|да| Reset["Новая неделя, used = 1"]
  Week -->|нет| Cap{used < лимит недели?}
  Cap -->|да| EatWeek["used + 1"]
  Cap -->|нет| Empty["Генерации закончились"]
```

Тарифы в продукте: free 1 / starter 10 за 50 ₽ / pro 50 за 200 ₽ / business 100 за 500 ₽. Самостоятельно тариф не сменить. Меняет админка.

---

## 7. Деплой

Триггер: push в `main` или ручной `workflow_dispatch`. Concurrent group `deploy-timeweb`, новый прогон отменяет старый.

```mermaid
flowchart TD
  Push([push main]) --> CI[GitHub Actions]
  CI --> Install[npm ci]
  Install --> Build["next build + prisma generate"]
  Build --> Pack["package-standalone.sh → release/"]
  Pack --> SSH[SSH ключ]
  SSH --> Rsync["rsync на Timeweb"]
  Rsync --> OA{Секреты OpenAI?}
  OA -->|есть| UpsertOA["upsert в .env"]
  OA -->|нет| SkipOA[Пропуск]
  UpsertOA --> TG{Токен Telegram?}
  SkipOA --> TG
  TG -->|есть| UpsertTG["upsert Telegram в .env"]
  TG -->|нет| SkipTG[Пропуск]
  UpsertTG --> Restart
  SkipTG --> Restart
  Restart["restart-app.sh"] --> Backup[["backup-db.js"]]
  Backup --> Migrate[["миграции Prisma"]]
  Migrate --> PM2r["pm2 startOrReload"]
  PM2r --> Health["curl localhost:3001"]
  Health --> Live([postvmeste.ru])
```

`restart-app.sh` ещё пересобирает `public_html` прокси под порт.

**rsync не затирает:** `.env`, `uploads/`, `backups/`, входящие файлы upsert, `.uptime-state.json`.

Секреты только в GitHub Actions: SSH, `OPENAI_*`, `OPENAI_IMAGE_*`, `TELEGRAM_BOT_TOKEN`. На сервере руками: база, Resend, `APP_URL`, `ADMIN_EMAILS`.

---

## 8. Живой сайт и алерты

```mermaid
flowchart TD
  Cron([каждые 5 мин]) --> Ping["GET /api/health"]
  Ping --> Ok{200?}
  Ok -->|да| WasDown{Уже слали down?}
  WasDown -->|да| Up["Telegram: сайт поднялся"]
  WasDown -->|нет| Quiet[Тишина]
  Ok -->|нет| Fail2{Второй фейл подряд?}
  Fail2 -->|нет| Wait[Ждём следующий тик]
  Fail2 -->|да| Down["Telegram: сайт лежит"]
```

Ошибки генерации и заготовка «платёж не прошёл» — из приложения, не из cron.

---

## 9. Потоки данных

### Регистрация и вход

```mermaid
sequenceDiagram
  participant U as Человек
  participant Auth as /api/auth
  participant DB as MySQL
  participant Mail as Resend

  U->>Auth: register + согласие
  alt нет Resend в production
    Auth-->>U: 503
  else ок
    Auth->>DB: User + Usage + Consent + EmailToken
    Auth->>Mail: письмо подтверждения
    Mail-->>U: ссылка /auth/verify
    U->>Auth: verify token
    Auth->>DB: emailVerifiedAt + Session
    Auth-->>U: cookie pv_session
  end
```

### Пост или обложка

```mermaid
sequenceDiagram
  participant U as Человек
  participant UI as create-flow
  participant API as /api/ai/compose
  participant Q as quota.ts
  participant Copy as ai-copy.ts
  participant Img as ai-image.ts
  participant Disk as uploads + FileAsset
  participant AI as шлюзы OpenAI

  U->>UI: Создать
  UI->>API: topic, text, captionSource
  API->>Q: quotaAvailable
  alt лимит 0
    API-->>UI: 402
  else есть лимит
    API->>Copy: composePost / composeReel
    Copy->>AI: JSON текст
    AI-->>Copy: хуки и подпись
    API->>Img: 3 картинки
    Img->>AI: PNG
    AI-->>Img: байты
    Img->>Disk: kind export
    API->>Q: consumeGeneration
    API-->>UI: 3 варианта
  end
```

Карусель на compose **не** списывает. Списание — после успешного expand.

---

## 10. Экраны и API

| Зона | Пути |
| --- | --- |
| Публичное | `/` `/offer` `/privacy` `/support` `/auth*` |
| Студия | `/dashboard` `/dashboard/create` `/dashboard/archive` `/dashboard/profile` |
| Админка | `/admin` |
| Auth API | `/api/auth/register` `login` `logout` `me` `verify` `forgot` `reset` |
| AI | `/api/ai/text` `compose` `expand` |
| Данные | `/api/works` `/api/rubrics` `/api/files` `/api/generations` `/api/profile` |
| Служебное | `/api/health` `/api/usage/tier` (403) `/api/admin/users` |

Админ в UI: `role === admin`. Админ в API: `authedAdmin()` + список `ADMIN_EMAILS` (при логине роль повышается).

---

## 11. Условия, которые легко забыть

1. Прод без Resend → регистрация 503.
2. Нет галочки согласия → регистрация 400.
3. Бан и неподтверждённая почта убивают сессию.
4. Карусель: превью бесплатно по лимиту, деньги/списание — за семёрку.
5. Пост без текста на шаге темы не стартует.
6. Обложка: свой текст/транскрипт/саммари не переписываем; пусто → подпись по хуку.
7. Референс залит или удалён → рецепт карусели сбрасывается, следующий compose снимет заново.
8. Картинка обложки: сначала 1024×1792, иначе квадрат.
9. Смена тарифа человеком закрыта, пока нет ЮKassa.
10. Алерт «сайт лежит» — только после **двух** провалов health подряд.
11. Стартовый бесплатный остаток на платном плане не сгорает — складывается с неделей.

---

## 12. Чего в карте ещё нет в коде

Это дыры продукта, не ошибки схемы:

- ЮKassa, вебхуки, чеки, экран оплаты
- «не нравится — перегенерировать» отдельной кнопкой
- хештеги поста из модели (сейчас локальные)
- саммари по вставленному видео рилса (план, п. 36)
- монтаж ролика, автопостинг, drag текста, логотип/фото в рендере
- Object Storage вместо локального `uploads/`

Живой план: `docs/work-plan.md`.
