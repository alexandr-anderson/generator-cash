#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"
load_server_env "$SCRIPT_DIR"
prepare_host_bins "$ROOT_DIR"

export NEXT_TELEMETRY_DISABLED=1

echo "==> postvmeste.ru restart"
echo "==> Project: ${ROOT_DIR}"
echo "==> Public web root: ${PUBLIC_HTML}"
echo "==> App port: ${APP_PORT}"
echo "==> Node: $("$NODE_BIN" -v) (${NODE_BIN})"

if [[ ! -f "${ROOT_DIR}/app/server.js" ]]; then
  echo "Missing ${ROOT_DIR}/app/server.js" >&2
  echo "Deploy a standalone build first (npm run deploy or GitHub Actions)." >&2
  exit 1
fi

ensure_public_html "$ROOT_DIR"
render_public_html_htaccess "$ROOT_DIR"

# Бэкап и миграции нужны только тогда, когда схема действительно меняется.
# Раньше они шли на каждом рестарте: бэкап без ограничения (mysqldump ждёт до
# 120 с плюс gzip 30), потом миграции, и лишь затем PM2. На шейред-хостинге
# Timeweb это упиралось в лимит процессов аккаунта — 2026-09-10 node падал с
# uv_thread_create ещё до вызова PM2, а до того рестарт просто не укладывался в
# отведённое время. В обоих случаях приложение оставалось со старым окружением.
# Поэтому сначала дёшево спрашиваем, есть ли неприменённые миграции.
migrations_pending=0
if [[ -f "${SCRIPT_DIR}/apply-migrations.php" ]]; then
  echo "==> Checking for pending migrations"
  set +e
  php "${SCRIPT_DIR}/apply-migrations.php" --check
  check_code=$?
  set -e
  if [[ "${check_code}" -eq 10 ]]; then
    migrations_pending=1
  elif [[ "${check_code}" -ne 0 ]]; then
    # Не смогли выяснить — считаем, что менять есть что, и идём длинным путём.
    echo "==> migration check failed (code ${check_code}), assuming pending"
    migrations_pending=1
  fi
else
  # Без PHP-варианта спросить нечем, поэтому идём как раньше.
  migrations_pending=1
fi

if [[ "${migrations_pending}" -eq 1 ]]; then
  if [[ -f "${SCRIPT_DIR}/backup-db.js" ]]; then
    echo "==> Backing up database (migrations pending)"
    if command -v timeout >/dev/null 2>&1; then
      if ! timeout --signal=TERM --kill-after=8 60 "$NODE_BIN" "${SCRIPT_DIR}/backup-db.js"; then
        echo "==> backup-db failed or timed out (non-fatal, continuing)"
      fi
    elif ! "$NODE_BIN" "${SCRIPT_DIR}/backup-db.js"; then
      echo "==> backup-db failed (non-fatal, continuing)"
    fi
  fi

  echo "==> Applying database migrations"
  if [[ -f "${SCRIPT_DIR}/apply-migrations.php" ]]; then
    php "${SCRIPT_DIR}/apply-migrations.php"
  elif [[ -f "${SCRIPT_DIR}/apply-migrations.js" ]]; then
    if command -v timeout >/dev/null 2>&1; then
      timeout --signal=TERM --kill-after=8 45 "$NODE_BIN" "${SCRIPT_DIR}/apply-migrations.js"
    else
      "$NODE_BIN" "${SCRIPT_DIR}/apply-migrations.js"
    fi
  fi
else
  echo "==> No pending migrations — skipping backup and migration step"
fi

run_pm2_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout --signal=TERM --kill-after=8 "${seconds}" "$NODE_BIN" "$PM2_BIN" "$@"
  else
    "$NODE_BIN" "$PM2_BIN" "$@"
  fi
}

# Повтор для случаев, когда node вообще не смог стартовать.
#
# На шейред-хостинге Timeweb аккаунту не хватает процессов, и node падает с
# `uv_thread_create` (код 134) ещё до того, как сделает что-либо полезное:
# поймано 2026-09-10 на деплое. Это состояние временное — пары секунд обычно
# хватает, чтобы фон разгрузился. Ошибки самого PM2 (не 134) не повторяем:
# они означают настоящую проблему, а не нехватку ресурсов в моменте.
run_pm2_retry() {
  local seconds="$1"
  shift
  local attempt
  for attempt in 1 2 3; do
    set +e
    run_pm2_timeout "${seconds}" "$@"
    local code=$?
    set -e
    if [[ "${code}" -eq 0 ]]; then
      return 0
    fi
    if [[ "${code}" -ne 134 ]]; then
      return "${code}"
    fi
    echo "==> node не смог стартовать (нехватка процессов, код 134), попытка ${attempt} из 3"
    sleep $((attempt * 5))
  done
  echo "Не удалось запустить node трижды подряд: на аккаунте кончились процессы." >&2
  return 134
}

resolve_pm2_bin "$ROOT_DIR"
prepend_node_path
pm2_version="$(run_pm2_retry 15 -v)"
echo "==> PM2: ${pm2_version} (${PM2_BIN})"

echo "==> Restarting PM2 process (does not pull git or upload a new build)"
# Запоминаем pid до рестарта: в fork-режиме перезапуск его меняет, и это
# единственный честный признак, что процесс действительно поднялся заново, а не
# продолжил работать со старым окружением. Раньше этого никто не проверял —
# и деплой считался «ну наверное применился», хотя не применялся.
pid_before="$(run_pm2_retry 10 pid "${APP_NAME}" 2>/dev/null | tr -d '[:space:]' || true)"
echo "==> PM2 pid before: ${pid_before:-none}"

APP_NAME="${APP_NAME}" APP_PORT="${APP_PORT}" NODE_ENV="${NODE_ENV}" NODE_BIN="${NODE_BIN}" \
  run_pm2_retry 60 startOrReload ecosystem.config.cjs --update-env
run_pm2_timeout 20 save || echo "pm2 save timed out (non-fatal)"

# Через retry: падение node от нехватки процессов здесь дало бы пустой pid
# и ложный вердикт «рестарт не удался».
pid_after="$(run_pm2_retry 10 pid "${APP_NAME}" 2>/dev/null | tr -d '[:space:]' || true)"
echo "==> PM2 pid after: ${pid_after:-none}"

if [[ -z "${pid_after}" ]]; then
  echo "Рестарт не удался: PM2 не сообщает pid процесса ${APP_NAME}." >&2
  exit 1
fi
if [[ -n "${pid_before}" && "${pid_before}" == "${pid_after}" ]]; then
  echo "Рестарт не удался: pid не изменился (${pid_after}) — процесс остался со старым окружением." >&2
  echo "Новые значения из .env (модель, ключи) в него НЕ попали." >&2
  exit 1
fi

echo "==> Restart finished"

echo "==> Health check http://127.0.0.1:${APP_PORT}"
sleep 2
curl -sI --max-time 8 "http://127.0.0.1:${APP_PORT}/" | head -8 || echo "App did not respond on ${APP_PORT} yet"
