#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"
load_server_env "$SCRIPT_DIR"
prepare_host_bins "$ROOT_DIR"

echo "==> postvmeste.ru diagnostics"
echo "Project: ${ROOT_DIR}"
echo "Public web root: ${PUBLIC_HTML}"
echo "PATH: ${PATH}"
echo "Node: ${NODE_BIN} ($("${NODE_BIN}" -v))"
echo "npm: ${NPM_BIN} ($("${NPM_BIN}" -v))"

if PM2_BIN="$(resolve_bin "${PM2_BIN:-}" pm2 "$ROOT_DIR" 2>/dev/null)"; then
  echo "PM2: ${PM2_BIN} ($("${PM2_BIN}" -v))"
else
  echo "PM2: not found yet (will appear after npm ci)"
fi

echo
echo "public_html:"
ls -la "${PUBLIC_HTML}" || true

echo
if [[ -d .git ]]; then
  echo "Git branch: $(git branch --show-current)"
  echo "Git remote: $(git remote get-url origin 2>/dev/null || echo 'missing')"
else
  echo "Git: repository not initialized"
fi

echo
if [[ -d node_modules ]]; then
  echo "node_modules: present"
else
  echo "node_modules: missing"
fi

if [[ -d app && -f app/server.js ]]; then
  echo "standalone app: present (${ROOT_DIR}/app/server.js)"
else
  echo "standalone app: missing (deploy release first)"
fi

if [[ -d .next ]]; then
  echo ".next build: present (dev only; production uses app/)"
else
  echo ".next build: missing"
fi

echo
echo "Port check (${APP_PORT}):"
if command -v ss >/dev/null 2>&1; then
  ss -ltn | grep ":${APP_PORT} " || echo "nothing listening on ${APP_PORT}"
elif command -v netstat >/dev/null 2>&1; then
  netstat -ltn | grep ":${APP_PORT} " || echo "nothing listening on ${APP_PORT}"
else
  echo "ss/netstat unavailable"
fi

echo
echo "Env files (values are not printed):"
if [[ -f "${ROOT_DIR}/.env" ]]; then echo ".env: present"; else echo ".env: missing"; fi
if [[ -f "${ROOT_DIR}/app/.env" ]]; then echo "app/.env: present"; else echo "app/.env: missing"; fi

env_key_present() {
  local key="$1"
  local file
  for file in "${ROOT_DIR}/.env" "${ROOT_DIR}/app/.env"; do
    [[ -f "$file" ]] || continue
    if grep -qE "^[[:space:]]*${key}=" "$file"; then
      return 0
    fi
  done
  return 1
}

echo
echo "Required secrets:"
if [[ -n "${RESEND_API_KEY:-}" ]] || env_key_present RESEND_API_KEY; then
  echo "RESEND_API_KEY: present"
else
  echo "RESEND_API_KEY: MISSING"
fi
if [[ -n "${DATABASE_URL:-}" ]] || env_key_present DATABASE_URL; then
  echo "DATABASE_URL: present"
else
  echo "DATABASE_URL: MISSING"
fi
if [[ -n "${APP_URL:-}" ]] || env_key_present APP_URL; then
  echo "APP_URL: present"
else
  echo "APP_URL: MISSING (default https://postvmeste.ru in PM2)"
fi

echo
echo "Health check http://127.0.0.1:${APP_PORT}/api/health"
curl -sS --max-time 8 "http://127.0.0.1:${APP_PORT}/api/health" || echo "health endpoint did not respond"
