#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STANDALONE_DIR="${ROOT_DIR}/.next/standalone"
RELEASE_DIR="${ROOT_DIR}/release"

if [[ ! -f "${STANDALONE_DIR}/server.js" ]]; then
  echo "Standalone build not found. Run npm run build first." >&2
  exit 1
fi

echo "==> Packaging standalone release"
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}/app/.next/static" "${RELEASE_DIR}/scripts" "${RELEASE_DIR}/public_html"

cp -a "${STANDALONE_DIR}/." "${RELEASE_DIR}/app/"
cp -a "${ROOT_DIR}/.next/static/." "${RELEASE_DIR}/app/.next/static/"

if [[ -d "${ROOT_DIR}/public" ]]; then
  cp -a "${ROOT_DIR}/public/." "${RELEASE_DIR}/app/public/"
fi

cp "${ROOT_DIR}/ecosystem.config.cjs" "${RELEASE_DIR}/"
cp "${ROOT_DIR}/scripts/restart-app.sh" "${RELEASE_DIR}/scripts/"
cp "${ROOT_DIR}/scripts/load-nvm.sh" "${RELEASE_DIR}/scripts/"
cp "${ROOT_DIR}/scripts/lib.sh" "${RELEASE_DIR}/scripts/"
cp "${ROOT_DIR}/scripts/doctor.sh" "${RELEASE_DIR}/scripts/"
cp "${ROOT_DIR}/public_html/.htaccess.template" "${RELEASE_DIR}/public_html/"

echo "==> Release ready at ${RELEASE_DIR}"
find "${RELEASE_DIR}" -maxdepth 3 -type f | sort
