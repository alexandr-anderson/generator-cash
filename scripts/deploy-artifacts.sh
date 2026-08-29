#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"
load_deploy_env "$SCRIPT_DIR"

export NEXT_TELEMETRY_DISABLED=1

echo "==> Building postvmeste.ru release"
echo "==> Node: $(node -v)"
echo "==> npm: $(npm -v)"

echo "==> Installing dependencies"
npm ci

echo "==> Running production build"
npm run build

bash "${SCRIPT_DIR}/package-standalone.sh"

ssh_target="${SSH_USER}@${SSH_HOST}"
ssh_opts=(
  -p "${SSH_PORT}"
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
)

if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then
  ssh_opts+=(-i "${SSH_IDENTITY_FILE/#\~/$HOME}")
fi

rsync_ssh="ssh ${ssh_opts[*]}"
rsync_opts=(
  -az
  --delete
  --exclude ".DS_Store"
)

echo "==> Uploading release to ${ssh_target}:${DEPLOY_PATH}"
ssh "${ssh_opts[@]}" "$ssh_target" "mkdir -p '${DEPLOY_PATH}' '${PUBLIC_HTML}'"

# shellcheck disable=SC2086
rsync "${rsync_opts[@]}" -e "$rsync_ssh" "${ROOT_DIR}/release/" "${ssh_target}:${DEPLOY_PATH}/"

echo "==> Restarting app on server"
run_remote "$SCRIPT_DIR" "$(export_remote_env)
cd '${DEPLOY_PATH}' && bash scripts/restart-app.sh"

echo "==> Deploy finished"
echo "Check https://postvmeste.ru after DNS/proxy reload if needed."
