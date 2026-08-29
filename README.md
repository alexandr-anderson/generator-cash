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

На аккаунте может быть несколько проектов. Для `postvmeste.ru` используйте такую структуру:

```text
/home/c/cm149295/
  filo-src/                         # другой проект
  postvmeste/                        # корень этого проекта
    deploy.sh
    package.json
    src/
    public_html/                     # сюда должен смотреть Timeweb
      .htaccess
```

В панели Timeweb для домена `postvmeste.ru` укажите корень сайта:

```text
/home/c/cm149295/postvmeste/public_html
```

Next.js запускается из `/home/c/cm149295/postvmeste` через PM2 на порту `3000`, а `public_html/.htaccess` проксирует запросы на приложение.

### Ручной деплой на сервере через SSH

```bash
bash /home/c/cm149295/postvmeste/deploy.sh
```

Скрипт сам:
1. подтянет актуальный код из `git` (`main`);
2. установит зависимости;
3. соберёт проект;
4. перезапустит приложение через PM2;
5. проверит наличие `public_html/.htaccess`.

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
git clone https://github.com/alexandr-anderson/generator-cash.git .
cp scripts/deploy.env.example scripts/deploy.env
bash /home/c/cm149295/postvmeste/deploy.sh
```

Если проект уже был разложен прямо в `public_html`, верните правильную структуру:

```bash
mkdir -p /home/c/cm149295/postvmeste
mv /home/c/cm149295/public_html/* /home/c/cm149295/postvmeste/ 2>/dev/null || true
mv /home/c/cm149295/public_html/.[!.]* /home/c/cm149295/postvmeste/ 2>/dev/null || true
cd /home/c/cm149295/postvmeste
git pull origin main
bash deploy.sh
```

Если видите `Permission denied (publickey)`, используйте HTTPS-клон, как выше.

Пример nginx-конфига: [`docs/nginx-postvmeste.example.conf`](docs/nginx-postvmeste.example.conf).

### Деплой с локального компьютера

Если нужно запускать деплой не на сервере, а с вашей машины:

```bash
cp scripts/deploy.env.example scripts/deploy.env
npm run deploy
```

### Проверка на сервере

```bash
bash /home/c/cm149295/postvmeste/scripts/doctor.sh
pm2 status
pm2 logs postvmeste
curl -I http://127.0.0.1:3000
```

### Если `Node.js not found`

На Timeweb Node.js обычно ставится через `nvm`, а не глобально.

Один раз выполните:

```bash
cd /home/c/cm149295/postvmeste
bash scripts/setup-node-timeweb.sh
source ~/.bash_profile
bash deploy.sh
```

### Если `pm2: command not found`

На Timeweb PM2 часто не установлен глобально. Это нормально: проект ставит PM2 локально через `npm ci`.

```bash
cd /home/c/cm149295/postvmeste
git pull origin main
bash deploy.sh
```

Или вручную:

```bash
cd /home/c/cm149295/postvmeste
source ~/.nvm/nvm.sh 2>/dev/null || true
npm ci
./node_modules/.bin/pm2 -v
./node_modules/.bin/pm2 startOrReload ecosystem.config.cjs --update-env
./node_modules/.bin/pm2 save
```

Если `node` тоже не найден, включите Node.js в панели Timeweb или пропишите пути в `scripts/deploy.env`.