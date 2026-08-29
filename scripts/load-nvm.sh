#!/usr/bin/env bash

set -euo pipefail

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1091
  source "${NVM_DIR}/nvm.sh"
  unset NPM_CONFIG_PREFIX 2>/dev/null || true
fi
