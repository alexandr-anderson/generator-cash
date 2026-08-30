#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

export NEXT_TELEMETRY_DISABLED=1

step "Building postvmeste.ru release"
echo "Node: $(node -v)"
echo "npm: $(npm -v)"

step "Installing dependencies"
npm ci --no-audit --fund=false --loglevel=info

step "Running production build"
npm run build

step "Packaging standalone release"
bash "${SCRIPT_DIR}/package-standalone.sh"

echo "Release ready in ${ROOT_DIR}/release"
