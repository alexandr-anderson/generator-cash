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

### Ручной деплой на сервере через SSH

Подключитесь к хостингу:

```bash
ssh cm149295@vh470.timeweb.ru
cd /home/c/cm149295/postvmeste
bash scripts/update-from-git.sh
```

Скрипт сам:
1. подтянет актуальный код из `git` (`main`);
2. установит зависимости;
3. соберёт проект;
4. перезапустит приложение через PM2.

При первом запуске на сервере создайте конфиг:

```bash
cp scripts/deploy.env.example scripts/deploy.env
```

Если `node`, `npm` или `pm2` не находятся автоматически, пропишите полные пути в `scripts/deploy.env`.

### Первый запуск, если проекта ещё нет на сервере

```bash
ssh cm149295@vh470.timeweb.ru
mkdir -p /home/c/cm149295/postvmeste
cd /home/c/cm149295/postvmeste
git clone git@github.com:alexandr-anderson/generator-cash.git .
cp scripts/deploy.env.example scripts/deploy.env
bash scripts/update-from-git.sh
```

Nginx уже должен проксировать домен на `127.0.0.1:3000`. Пример конфига: [`docs/nginx-postvmeste.example.conf`](docs/nginx-postvmeste.example.conf).

### Деплой с локального компьютера

Если нужно запускать деплой не на сервере, а с вашей машины:

```bash
cp scripts/deploy.env.example scripts/deploy.env
npm run deploy
```

### Проверка на сервере

```bash
pm2 status
pm2 logs postvmeste
```