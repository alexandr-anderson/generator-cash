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

## Деплой на Timeweb через SSH

### 1. Подготовка локально

```bash
cp scripts/deploy.env.example scripts/deploy.env
```

Проверь значения в `scripts/deploy.env`. Если на сервере `node`, `npm` или `pm2` не в `PATH`, укажи полные пути в `NODE_BIN`, `NPM_BIN`, `PM2_BIN`.

### 2. Первый запуск на сервере

На сервере должны быть установлены `git`, `node`, `npm` и `pm2`. Nginx уже должен проксировать домен на `127.0.0.1:3000`. Пример конфига: [`docs/nginx-postvmeste.example.conf`](docs/nginx-postvmeste.example.conf).

```bash
npm run deploy:bootstrap
```

Скрипт создаст `/home/c/cm149295/postvmeste`, сделает `git clone`, соберёт приложение и запустит его через PM2.

### 3. Обычный деплой

После каждого merge в `main`:

```bash
npm run deploy
```

Скрипт по SSH зайдёт на сервер, выполнит `git pull`, `npm ci`, `npm run build` и `pm2 startOrReload`.

### 4. Проверка на сервере

```bash
ssh cm149295@vh470.timeweb.ru
cd /home/c/cm149295/postvmeste
pm2 status
pm2 logs postvmeste
```