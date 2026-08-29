#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/load-nvm.sh
source "${ROOT_DIR}/scripts/load-nvm.sh"
exec bash "${ROOT_DIR}/scripts/update-from-git.sh" "$@"
