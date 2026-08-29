#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

load_deploy_env "$SCRIPT_DIR"

echo "==> Deploying to ${SSH_USER}@${SSH_HOST}:${DEPLOY_PATH}"

run_remote "$SCRIPT_DIR" "$(export_remote_env)
cd '${DEPLOY_PATH}' && bash scripts/remote-deploy.sh"

echo "==> Done. Check https://postvmeste.ru after nginx reload if needed."
