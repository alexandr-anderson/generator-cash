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

if [[ -f "${SCRIPT_DIR}/apply-migrations.php" ]]; then
  echo "==> Applying database migrations"
  php "${SCRIPT_DIR}/apply-migrations.php"
elif [[ -f "${SCRIPT_DIR}/apply-migrations.js" ]]; then
  echo "==> Applying database migrations"
  if command -v timeout >/dev/null 2>&1; then
    timeout --signal=TERM --kill-after=8 45 "$NODE_BIN" "${SCRIPT_DIR}/apply-migrations.js"
  else
    "$NODE_BIN" "${SCRIPT_DIR}/apply-migrations.js"
  fi
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

resolve_pm2_bin "$ROOT_DIR"
prepend_node_path
pm2_version="$(run_pm2_timeout 15 -v)"
echo "==> PM2: ${pm2_version} (${PM2_BIN})"

echo "==> Restarting PM2 process (does not pull git or upload a new build)"
APP_NAME="${APP_NAME}" APP_PORT="${APP_PORT}" NODE_ENV="${NODE_ENV}" NODE_BIN="${NODE_BIN}" \
  run_pm2_timeout 60 startOrReload ecosystem.config.cjs --update-env
run_pm2_timeout 20 save || echo "pm2 save timed out (non-fatal)"

echo "==> Restart finished"
echo "==> PM2 pid: $(run_pm2_timeout 10 pid "${APP_NAME}" || echo unknown)"

echo "==> Health check http://127.0.0.1:${APP_PORT}"
sleep 2
curl -sI --max-time 8 "http://127.0.0.1:${APP_PORT}/" | head -8 || echo "App did not respond on ${APP_PORT} yet"
