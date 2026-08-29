#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat >&2 <<'EOF'
On-server git pull + next build is disabled for Timeweb shared hosting.

Build locally or in GitHub Actions, then deploy artifacts:
  npm run deploy

If the release is already on the server, restarting only:
EOF

exec bash "${SCRIPT_DIR}/restart-app.sh" "$@"
