# postvmeste.ru

Рабочий MVP AI-студии для соло-креаторов. Пользователь загружает собственные референсы, проверяет извлечённый Brand DNA и получает согласованный пакет: обложку Reels, пост 4:5 и карусель.

## Запуск

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Проверки

```bash
npm run lint
npm test
npm run build
```

## Что реализовано

- drag-and-drop загрузка PNG/JPEG/WEBP с подтверждением прав;
- evidence-backed Brand DNA с редактируемыми признаками и палитрой;
- контент-бриф и три визуальных направления;
- переключение Reel/Post/Carousel в лёгком редакторе;
- редактирование текста и цветов;
- экспорт PNG-файлов в ZIP вместе с `provenance.json`;
- удаление локальных материалов и сброс проекта;
- защищённые API-контракты для анализа и генерации;
- PostgreSQL-модель production-данных в `prisma/schema.prisma`.

В MVP используется deterministic local provider, поэтому приложение работает без API-ключей и не отправляет пользовательские файлы третьим сторонам. Границы production-интеграции и retention описаны в [`docs/architecture.md`](docs/architecture.md), а сценарий проверки спроса — в [`docs/concierge-playbook.md`](docs/concierge-playbook.md).

## Деплой на Timeweb

> **Важно:** `npm run deploy` запускается **с вашего компьютера** (Mac/Windows/Linux), где есть клон репозитория.  
> **Не** запускайте его в SSH-сессии Timeweb — на сервере нет исходников и `package.json`.

На shared hosting Timeweb **нельзя надёжно собирать Next.js на сервере** (`next build` падает с `uv_thread_create`). Поэтому используется artifact-based деплой:

1. **Сборка** — локально или в GitHub Actions.
2. **На сервер** — только готовый standalone-бандл + перезапуск PM2.
3. **SSH** — с локальной машины или через терминал в панели Timeweb.

### Структура на сервере

```text
/home/c/cm149295/
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
/home/c/cm149295/postvmeste/public_html
```

PM2 запускает `app/server.js` на `APP_PORT` (по умолчанию `3000`). Apache в `public_html/.htaccess` проксирует запросы на этот порт.

### GitHub Actions (рекомендуется)

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — срабатывает на push в `main` или вручную.

Добавьте secrets в репозитории (`Settings → Secrets and variables → Actions`):

| Secret | Значение |
|--------|----------|
| `SSH_PRIVATE_KEY` | приватный ключ с доступом к Timeweb SSH |
| `SSH_HOST` | `vh470.timeweb.ru` |
| `SSH_USER` | `cm149295` |
| `SSH_PORT` | `22` (опционально) |

После push в `main` Actions соберёт проект, загрузит `release/` на сервер и выполнит `scripts/restart-app.sh`.

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
DEPLOY_PATH=/home/c/cm149295/postvmeste
PUBLIC_HTML=/home/c/cm149295/postvmeste/public_html
APP_NAME=postvmeste
APP_PORT=3000
NODE_ENV=production
EOF
```

Если порт 3000 занят другим проектом (`filo`), поставьте `APP_PORT=3001`.

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
ssh cm149295@vh470.timeweb.ru
bash /home/c/cm149295/postvmeste/scripts/setup-node-timeweb.sh
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
ssh cm149295@vh470.timeweb.ru
bash /home/c/cm149295/postvmeste/scripts/restart-app.sh
```

Или через SSH с локальной машины:

```bash
npm run deploy:server
```

(при наличии `scripts/deploy.env` и настроенного SSH-ключа)

### Проверка на сервере

```bash
bash /home/c/cm149295/postvmeste/scripts/doctor.sh
pm2 status
pm2 logs postvmeste
curl -I http://127.0.0.1:3000
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
bash /home/c/cm149295/postvmeste/scripts/setup-node-timeweb.sh
```

### Устаревший способ (не использовать)

`git pull` + `next build` на сервере больше не поддерживается. Скрипт `deploy.sh` на сервере теперь только перезапускает уже загруженный release.

Пример nginx-конфига: [`docs/nginx-postvmeste.example.conf`](docs/nginx-postvmeste.example.conf).