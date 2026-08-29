#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"
load_server_env "$SCRIPT_DIR"

NODE_BIN="$(resolve_bin "${NODE_BIN:-}" node)"
NPM_BIN="$(resolve_bin "${NPM_BIN:-}" npm)"
PM2_BIN="$(resolve_bin "${PM2_BIN:-}" pm2)"

export NODE_ENV
export PORT="${APP_PORT}"
export NEXT_TELEMETRY_DISABLED=1

echo "==> postvmeste.ru update"
echo "==> Project: ${ROOT_DIR}"
echo "==> Public web root: ${PUBLIC_HTML}"
echo "==> Branch: ${GIT_BRANCH}"
echo "==> Node: $("$NODE_BIN" -v)"
echo "==> PM2: $("$PM2_BIN" -v)"

if [[ ! -d .git ]]; then
  echo "Git repository not found in ${ROOT_DIR}." >&2
  echo "Clone the project first, for example:" >&2
  echo "  git clone https://github.com/alexandr-anderson/generator-cash.git ${ROOT_DIR}" >&2
  exit 1
fi

echo "==> Pulling latest code from git"
git fetch "${GIT_REMOTE}"
git checkout "${GIT_BRANCH}"
git pull --ff-only "${GIT_REMOTE}" "${GIT_BRANCH}"

echo "==> Installing dependencies"
"$NPM_BIN" ci

echo "==> Building application"
"$NPM_BIN" run build

echo "==> Restarting PM2 process"
APP_NAME="${APP_NAME}" APP_PORT="${APP_PORT}" NODE_ENV="${NODE_ENV}" \
  "$PM2_BIN" startOrReload ecosystem.config.cjs --update-env
"$PM2_BIN" save

ensure_public_html "${ROOT_DIR}"
echo "==> Apache proxy config: ${PUBLIC_HTML}/.htaccess"

echo "==> Update finished"
"$PM2_BIN" status "${APP_NAME}"
