#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

load_deploy_env "$SCRIPT_DIR"

echo "==> Bootstrapping ${DEPLOY_PATH} on ${SSH_USER}@${SSH_HOST}"

run_remote "$SCRIPT_DIR" "$(export_remote_env)
set -euo pipefail
mkdir -p '${DEPLOY_PATH}' '${PUBLIC_HTML}'
echo 'Directories ready:'
ls -la '${DEPLOY_PATH}' '${PUBLIC_HTML}' || true
"

echo "==> Bootstrap finished"
echo "Next: run npm run deploy locally or push to main after GitHub Actions secrets are configured."
