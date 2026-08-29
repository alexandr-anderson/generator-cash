#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-nvm.sh
source "${SCRIPT_DIR}/load-nvm.sh"

echo "==> Timeweb Node.js setup"

touch "${HOME}/.bash_profile"

if [[ ! -s "${HOME}/.nvm/nvm.sh" ]]; then
  echo "==> Installing nvm"
  curl -Ls https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
  # shellcheck source=load-nvm.sh
  source "${SCRIPT_DIR}/load-nvm.sh"
else
  echo "==> nvm already installed"
fi

if ! grep -q 'NVM_DIR' "${HOME}/.bash_profile" 2>/dev/null; then
  cat >> "${HOME}/.bash_profile" <<'EOF'

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF
fi

unset NPM_CONFIG_PREFIX 2>/dev/null || true

NODE_VERSION="${NODE_VERSION:-22}"
echo "==> Installing Node.js ${NODE_VERSION}"
nvm install "${NODE_VERSION}"
nvm alias default "${NODE_VERSION}"
nvm use default

cat <<EOF

Node.js setup complete:
  node: $(command -v node) ($(node -v))
  npm:  $(command -v npm) ($(npm -v))

Next steps:
  cd /home/c/cm149295/postvmeste
  bash deploy.sh
EOF
