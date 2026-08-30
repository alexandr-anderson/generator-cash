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
echo "==> Node: $("$NODE_BIN" -v)"

if [[ ! -f "${ROOT_DIR}/app/server.js" ]]; then
  echo "Missing ${ROOT_DIR}/app/server.js" >&2
  echo "Deploy a standalone build first (npm run deploy or GitHub Actions)." >&2
  exit 1
fi

if ! PM2_BIN="$(resolve_bin "${PM2_BIN:-}" pm2 "$ROOT_DIR" 2>/dev/null)"; then
  resolve_pm2_bin "$ROOT_DIR"
fi
echo "==> PM2: $("$PM2_BIN" -v)"

ensure_public_html "$ROOT_DIR"
render_public_html_htaccess "$ROOT_DIR"

echo "==> Restarting PM2 process"
APP_NAME="${APP_NAME}" APP_PORT="${APP_PORT}" NODE_ENV="${NODE_ENV}" \
  "$PM2_BIN" startOrReload ecosystem.config.cjs --update-env --silent
"$PM2_BIN" save --silent

echo "==> Restart finished"
echo "==> PM2 pid: $("$PM2_BIN" pid "${APP_NAME}" || echo unknown)"

echo "==> Health check http://127.0.0.1:${APP_PORT}"
sleep 2
curl -sI --max-time 8 "http://127.0.0.1:${APP_PORT}/" | head -8 || echo "App did not respond on ${APP_PORT} yet"
