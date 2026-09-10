# Деплой и локальная разработка

> Внутренний документ для тех, кто ведёт проект. Продуктовое описание сервиса — в [README](../README.md).

## Локальный запуск

Скопируйте `.env.example` в `.env`, укажите `DATABASE_URL` и `RESEND_API_KEY`.

```bash
npm install
npx prisma migrate deploy
SEED_DEMO_PASSWORD='ваш-пароль' npx prisma db seed   # создаст demo@postvmeste.ru
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Проверки

```bash
npm run lint
npm test
npm run build
```

## Деплой на Timeweb

> **Важно:** `npm run deploy` запускается **с вашего компьютера** (Mac/Windows/Linux), где есть клон репозитория.  
> **Не** запускайте его в SSH-сессии Timeweb — на сервере нет исходников и `package.json`.

На shared hosting Timeweb **нельзя надёжно собирать Next.js на сервере** (`next build` падает с `uv_thread_create`). Поэтому используется artifact-based деплой:

1. **Сборка** — локально или в GitHub Actions.
2. **На сервер** — только готовый standalone-бандл + перезапуск PM2.
3. **SSH** — с локальной машины или через терминал в панели Timeweb.

На этом аккаунте порт `3000` занят проектом `filo`. postvmeste.ru слушает **`3001`**.

### Чистый первый деплой

Два окна, не смешивать команды:

- **SSH Timeweb** — `<SSH_USER>@<SSH_HOST>:~$` (Linux bash)
- **Локальный Windows** — PowerShell на вашем ПК

**Не удаляйте** `~/filo` и `~/filo-src`.

1. На сервере удалите только `postvmeste`, создайте пустые каталоги и `scripts/deploy.env` с `APP_PORT=3001`.
2. В панели Timeweb корень сайта `postvmeste.ru` = `/home/c/<SSH_USER>/postvmeste/public_html`.
3. На Windows удалите старый клон, затем `git clone https://github.com/alexandr-anderson/generator-cash.git`.
4. Сборку и загрузку делайте **локально** (`npm run deploy`) или через **GitHub Actions**. На сервере `npm ci` / `npm run build` не запускайте.

### Структура на сервере

```text
/home/c/<SSH_USER>/
  postvmeste/
    app/                     # standalone Next.js (server.js, .next, public)
    ecosystem.config.cjs
    scripts/
      restart-app.sh
    public_html/             # document root в панели Timeweb
      .htaccess              # генерируется из шаблона при restart
```

В панели Timeweb для домена `postvmeste.ru` укажите корень сайта:

```text
/home/c/<SSH_USER>/postvmeste/public_html
```

PM2 запускает `app/server.js` на `APP_PORT` (на этом аккаунте `3001`). Apache в `public_html/.htaccess` проксирует запросы на этот порт.

### Прокси — это PHP, и он стримит

Timeweb не даёт Apache `[P]` / mod_proxy, поэтому весь трафик идёт через `public_html/index.php`, который генерируется из `index.php.template` (подстановка `__APP_PORT__` в `scripts/lib.sh`). **Это входная дверь всего сайта: синтаксическая ошибка в нём кладёт домен целиком.** После правок стоит проверить на сервере:

```bash
php -l ~/postvmeste/public_html/index.php
```

Скрипт пересылает ответ **чанками**, а не собирает целиком. Это не украшательство: шлюз модели молчит около двух минут до первого байта, и буферизующий прокси превращал это в оборванное соединение. До 2026-09-10 здесь стояли `CURLOPT_RETURNTRANSFER` и потолок в 200 секунд — именно он, а не какой-то сторонний middlebox, убивал длинные генерации (`net::ERR_CONNECTION_TIMED_OUT` в браузере).

Что важно не сломать при будущих правках:
- `CURLOPT_HEADERFUNCTION` / `CURLOPT_WRITEFUNCTION` вместо `CURLOPT_RETURNTRANSFER`;
- сброшенные буферы (`ob_end_flush`, `ob_implicit_flush`) и `flush()` после каждого чанка;
- `content-length` не пересылается — длина исходного ответа больше не описывает то, что уходит клиенту;
- нет `CURLOPT_TIMEOUT`, зависание ловится `CURLOPT_LOW_SPEED_LIMIT` / `LOW_SPEED_TIME`.

### GitHub Actions (рекомендуется)

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — срабатывает на push в `main` или вручную.

Добавьте secrets в репозитории (`Settings → Secrets and variables → Actions`):

| Secret | Значение |
|--------|----------|
| `SSH_PRIVATE_KEY` | приватный ключ с доступом к Timeweb SSH |
| `SSH_HOST` | `<SSH_HOST>` |
| `SSH_USER` | `<ваш-логин>` |
| `SSH_PORT` | `22` (опционально) |
| `TELEGRAM_BOT_TOKEN` | токен бота от @BotFather — алерты в Telegram |
| `TELEGRAM_CHAT_ID` | опционально, числовой chat id; иначе бот ждёт `/start` от получателя (задаётся переменной `TELEGRAM_CHAT`) |

После push в `main` Actions соберёт проект, загрузит `release/` на сервер и выполнит `scripts/restart-app.sh`.

`rsync --delete` не трогает `~/postvmeste/.env`, `app/.env`, `uploads/` и `scripts/deploy.env`. Рестарт PM2 ограничен 90 секундами, чтобы зависший `pm2` не забивал лимит процессов Timeweb.

Чтобы выкатить другую ветку, не дожидаясь merge: **Actions → Deploy to Timeweb → Run workflow → выбрать ветку**. Рестарт PM2 на сервере **не** подтягивает git — в проде только тот бандл, который последний раз залил Actions или `npm run deploy`.

Открытый pull request деплой **не** запускает: триггеры только `push` в `main` и ручной `workflow_dispatch`.

### Как менять ключи и модели (важно)

**Правьте GitHub Secrets, а не `.env` на сервере.** Шаги «Sync OpenAI env on server» и «Sync Telegram env on server» на каждом деплое переписывают в `~/postvmeste/.env` эти ключи значениями из секретов, через `scripts/upsert-env-keys.php` (он именно **заменяет** существующий ключ):

`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_IMAGE_BASE_URL`, `OPENAI_IMAGE_API_KEY`, `OPENAI_IMAGE_MODEL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT`, `TELEGRAM_CHAT_ID`.

Поэтому правка любого из них руками в серверном `.env` живёт **до первого следующего деплоя**, а потом молча откатывается. Хуже того: если секрет `OPENAI_MODEL` пуст, а `OPENAI_API_KEY` задан, деплой впишет дефолт `gpt-5.5` — то есть тихо вернёт модель, которую вы меняли.

Правильный порядок смены модели или ключа: поменять секрет → **Actions → Deploy to Timeweb → Run workflow**. Деплой сам зальёт значение и рестартанёт PM2.

Остальные переменные (`DATABASE_URL`, `SESSION_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `APP_URL`) деплой не трогает — они живут только в серверном `.env`, и править их надо там, с последующим `bash ~/postvmeste/scripts/restart-app.sh`.

### Как проверить, какая модель реально на проде

Три способа, от быстрого к точному:

1. **Лог деплоя, шаг «Sync OpenAI env on server».** Он печатает длины значений, не сами значения:
   `OPENAI_MODEL len=11` — это `chatgpt-5.6`, `len=7` — старый `gpt-5.5`. Проверка за секунду, без SSH.
2. **`/api/health` под админом** — поле `textModel` (для неавторизованных имена моделей по-прежнему скрыты, это из security-прохода).
3. **Стартовый лог** `[pm2-env]` и `[boot]` — там `textModel=…` рядом с `imageModel=…`.

**Запасного значения модели больше нигде нет — и это сделано специально.** Раньше `gpt-5.5` был
прописан в трёх местах сразу (`openai.ts`, `ecosystem.config.cjs`, шаг деплоя). Из-за этого смена
модели дважды «прошла успешно», а прод двое суток работал на старой модели: настройки не было, но
подставлялось молча — да ещё и записывалось в серверный `.env`, закрепляя ошибку. Нашлось только по
логам самого шлюза.

Теперь: пустой секрет `OPENAI_MODEL` деплой **не записывает** (оставляет серверное значение и пишет
warning), а приложение без модели отвечает честной ошибкой и показывает `ai: "missing"` в `/api/health`.

### `exit 124` на шаге `Restart app on server` — это НЕ «наверное всё хорошо»

> Здесь раньше стояла обратная по смыслу заметка — будто красный крест на этом шаге не значит, что
> изменения не применились. Она стоила двух суток: прод работал не на той модели, а мы считали
> вопрос закрытым. Формально «не значит, что не применились» верно, но и обратного не значит —
> а проверить было нечем.

Разобрано 2026-09-10. Причина была арифметическая: скрипту давали **90 секунд**, а внутри до PM2
успевали отработать бэкап базы (`mysqldump` со своим таймаутом 120 с плюс `gzip` 30 с, внешнего
ограничения не было вовсе) и миграции (45 с). Бюджет заканчивался **до того**, как PM2 вообще
трогали: серверный `.env` обновлялся, а процесс продолжал жить со старым окружением. Файл новый,
память старая — и никакого сигнала об этом.

Что сделано:
- бэкап ограничен 60 секундами (он важен, но не ценой самого рестарта);
- бюджеты подняты по худшему случаю: `timeout 240` на скрипт, `timeout 300` на ssh;
- **`restart-app.sh` теперь сверяет pid до и после** и падает с внятным текстом, если процесс не
  сменился. В fork-режиме неизменный pid означает ровно одно: перезапуска не было и новые значения
  из `.env` внутрь не попали.

Если шаг всё же покраснел — считайте, что **изменения не применились**, и перезапустите рестарт
вручную (на сервере лимита в 90 секунд нет):

```bash
bash ~/postvmeste/scripts/restart-app.sh
```

После деплоя проверьте `https://postvmeste.ru/api/health`: `mail: "ok"` значит ключ Resend попал в процесс, `404` — на сервере ещё старый UI-бандл без почты.

### Миграция со старой структуры (полный git-клон на сервере)

Если на Timeweb уже лежит полный репозиторий (`src/`, `package.json`, `node_modules/` и т.д.), это **старый способ**. Первый artifact-деплой заменит его на runtime-структуру:

```text
postvmeste/
  app/                     # готовый standalone-билд
  ecosystem.config.cjs
  scripts/
    restart-app.sh
    deploy.env.example
    deploy.env             # ваш конфиг на сервере (сохраняется между деплоями)
  public_html/
    .htaccess              # генерируется при restart
```

Файлы `src/`, `docs/`, `prisma/`, старый `node_modules/` и прочие исходники **будут удалены** при первом `rsync --delete` — это нормально.

**Не запускайте** на сервере `git pull`, `npm run build` или старый `bash deploy.sh` до первого artifact-деплоя.

Перед деплоем на сервере создайте (опционально) `scripts/deploy.env` — он не перезаписывается при загрузке:

```bash
mkdir -p ~/postvmeste/scripts
cat > ~/postvmeste/scripts/deploy.env << 'EOF'
DEPLOY_PATH=/home/c/<SSH_USER>/postvmeste
PUBLIC_HTML=/home/c/<SSH_USER>/postvmeste/public_html
APP_NAME=postvmeste
APP_PORT=3001
NODE_ENV=production
EOF
```

### Что делать на сервере (SSH Timeweb)

Только подготовка окружения — **без** `npm run deploy`:

```bash
mkdir -p ~/postvmeste/public_html
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
node -v
```

После загрузки release (с локальной машины или GitHub Actions) перезапуск:

```bash
bash ~/postvmeste/scripts/restart-app.sh
```

### Деплой с локального компьютера

**Windows:** Git Bash часто «замирает» на `npm ci` (антивирус, медленный диск) или не имеет `rsync`. Если деплой висит больше 5 минут без новых строк — нажмите `Ctrl+C` и см. раздел «Если deploy завис» ниже. Проще всего на Windows — **GitHub Actions**.

```bash
git clone https://github.com/alexandr-anderson/generator-cash.git
cd generator-cash
cp scripts/deploy.env.example scripts/deploy.env
# при необходимости: SSH_IDENTITY_FILE=~/.ssh/id_ed25519
npm run deploy
```

Только сборка без загрузки на сервер:

```bash
npm run deploy:build
```

### Если deploy завис (Windows)

1. `Ctrl+C` — остановить.
2. Проверить по шагам в **PowerShell** или **cmd** (не Git Bash):

```bat
node -v
npm -v
npm ci
npm run build
```

3. Если `npm ci` висит — удалите `node_modules`, затем снова `npm ci`.
4. Если сборка прошла, но нет `rsync` — используйте **GitHub Actions** (Settings → Secrets → `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, затем Actions → Deploy to Timeweb → Run workflow).

Скрипт:
1. `npm ci` + `npm run build`;
2. упакует standalone в `release/`;
3. `rsync` на сервер;
4. перезапустит PM2 через SSH.

### Первый запуск на сервере

Подключитесь по SSH (локально или через панель Timeweb):

```bash
ssh <SSH_USER>@<SSH_HOST>
bash /home/c/<SSH_USER>/postvmeste/scripts/setup-node-timeweb.sh
```

Подготовьте каталоги (с локальной машины):

```bash
cp scripts/deploy.env.example scripts/deploy.env
npm run deploy:bootstrap
npm run deploy
```

На сервере **не нужен** `git clone` всего репозитория — только Node.js, PM2 и загруженный release.

### Перезапуск без новой сборки

Если release уже на сервере:

```bash
ssh <SSH_USER>@<SSH_HOST>
bash /home/c/<SSH_USER>/postvmeste/scripts/restart-app.sh
```

Или через SSH с локальной машины:

```bash
npm run deploy:server
```

(при наличии `scripts/deploy.env` и настроенного SSH-ключа)

### Проверка на сервере

```bash
bash /home/c/<SSH_USER>/postvmeste/scripts/doctor.sh
pm2 status
pm2 logs postvmeste
curl -I http://127.0.0.1:3001
```

### Если порт 3000 занят

На аккаунте может уже работать другое приложение на `:3000`. Проверьте:

```bash
ss -ltn | grep ':3000 '
curl -I http://127.0.0.1:3000
```

Если порт занят, задайте другой порт в `scripts/deploy.env` на сервере и в GitHub Actions env (`APP_PORT=3001`), затем выполните deploy/restart — `.htaccess` перегенерируется автоматически.

### Если `Node.js not found`

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
bash /home/c/<SSH_USER>/postvmeste/scripts/setup-node-timeweb.sh
```

### Устаревший способ (не использовать)

`git pull` + `next build` на сервере больше не поддерживается. Скрипт `deploy.sh` на сервере теперь только перезапускает уже загруженный release.

