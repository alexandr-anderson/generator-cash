#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

load_deploy_env "$SCRIPT_DIR"

: "${GIT_REPO_URL:?Set GIT_REPO_URL in scripts/deploy.env for first-time bootstrap}"

echo "==> Bootstrapping ${DEPLOY_PATH} on ${SSH_USER}@${SSH_HOST}"

run_remote "$SCRIPT_DIR" "$(export_remote_env)
set -euo pipefail

NODE_BIN=\"\$(command -v node)\"
NPM_BIN=\"\$(command -v npm)\"
PM2_BIN=\"\$(command -v pm2)\"

if [[ ! -d '${DEPLOY_PATH}' ]]; then
  mkdir -p '${DEPLOY_PATH}'
fi

cd '${DEPLOY_PATH}'

if [[ ! -d .git ]]; then
  git clone '${GIT_REPO_URL}' .
fi

git fetch '${GIT_REMOTE}'
git checkout '${GIT_BRANCH}'
git pull --ff-only '${GIT_REMOTE}' '${GIT_BRANCH}'

\"\$NPM_BIN\" ci
\"\$NPM_BIN\" run build

APP_NAME='${APP_NAME}' APP_PORT='${APP_PORT}' NODE_ENV='${NODE_ENV}' \
  \"\$PM2_BIN\" startOrReload ecosystem.config.cjs --update-env
\"\$PM2_BIN\" save

echo 'Bootstrap complete.'
\"\$PM2_BIN\" status '${APP_NAME}'
"

echo "==> Bootstrap finished"
