#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${DEPLOY_PATH:=$ROOT_DIR}"
: "${GIT_BRANCH:=main}"
: "${GIT_REMOTE:=origin}"
: "${APP_NAME:=postvmeste}"
: "${APP_PORT:=3000}"
: "${NODE_ENV:=production}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

NODE_BIN="$(resolve_bin "${NODE_BIN:-}" node)"
NPM_BIN="$(resolve_bin "${NPM_BIN:-}" npm)"
PM2_BIN="$(resolve_bin "${PM2_BIN:-}" pm2)"

export NODE_ENV
export PORT="${APP_PORT}"
export NEXT_TELEMETRY_DISABLED=1

echo "==> Deploy path: ${ROOT_DIR}"
echo "==> Branch: ${GIT_BRANCH}"
echo "==> Node: $("$NODE_BIN" -v)"
echo "==> PM2: $("$PM2_BIN" -v)"

if [[ ! -d .git ]]; then
  echo "This directory is not a git repository. Run scripts/bootstrap-server.sh first." >&2
  exit 1
fi

echo "==> Updating source code"
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

echo "==> Deployment finished"
"$PM2_BIN" status "${APP_NAME}"
