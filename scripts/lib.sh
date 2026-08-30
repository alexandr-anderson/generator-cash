#!/usr/bin/env bash

set -euo pipefail

resolve_bin() {
  local override="$1"
  local fallback="$2"
  local root_dir="${3:-}"

  if [[ -n "$override" && -x "$override" ]]; then
    printf '%s\n' "$override"
    return
  fi

  if [[ -n "$root_dir" && -x "${root_dir}/node_modules/.bin/${fallback}" ]]; then
    printf '%s\n' "${root_dir}/node_modules/.bin/${fallback}"
    return
  fi

  if [[ -d "${HOME}/.nvm/versions/node" ]]; then
    local latest_node_dir
    latest_node_dir="$(ls -1 "${HOME}/.nvm/versions/node" 2>/dev/null | sort -V | tail -n 1 || true)"
    if [[ -n "$latest_node_dir" && -x "${HOME}/.nvm/versions/node/${latest_node_dir}/bin/${fallback}" ]]; then
      printf '%s\n' "${HOME}/.nvm/versions/node/${latest_node_dir}/bin/${fallback}"
      return
    fi
  fi

  if command -v "$fallback" >/dev/null 2>&1; then
    command -v "$fallback"
    return
  fi

  return 1
}

load_nvm_if_needed() {
  # shellcheck source=load-nvm.sh
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/load-nvm.sh"
}

print_node_setup_help() {
  cat >&2 <<'EOF'
Node.js not found on this Timeweb account.

Run once:
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22

Or:
  bash /home/c/cm149295/postvmeste/scripts/setup-node-timeweb.sh

Then deploy:
  cd /home/c/cm149295/postvmeste
  bash deploy.sh
EOF
}

prepare_host_bins() {
  local root_dir="$1"

  load_nvm_if_needed

  NODE_BIN="$(resolve_bin "${NODE_BIN:-}" node "$root_dir")" || {
    print_node_setup_help
    exit 1
  }

  NPM_BIN="$(resolve_bin "${NPM_BIN:-}" npm "$root_dir")" || {
    echo "npm not found. Install npm or set NPM_BIN in scripts/deploy.env." >&2
    exit 1
  }
}

resolve_pm2_bin() {
  local root_dir="$1"
  local candidate

  if [[ -n "${PM2_BIN:-}" && -x "${PM2_BIN}" ]]; then
    return
  fi

  for candidate in \
    "${HOME}/filo-src/node_modules/.bin/pm2" \
    "${HOME}/filo/node_modules/.bin/pm2"
  do
    if [[ -x "$candidate" ]]; then
      PM2_BIN="$candidate"
      return
    fi
  done

  if [[ -d "${HOME}/.nvm/versions/node" ]]; then
    local node_dir
    for node_dir in "${HOME}/.nvm/versions/node"/*; do
      if [[ -x "${node_dir}/bin/pm2" ]]; then
        PM2_BIN="${node_dir}/bin/pm2"
        return
      fi
    done
  fi

  if command -v pm2 >/dev/null 2>&1; then
    PM2_BIN="$(command -v pm2)"
    return
  fi

  if [[ -x "${root_dir}/node_modules/.bin/pm2" ]]; then
    PM2_BIN="${root_dir}/node_modules/.bin/pm2"
    return
  fi

  echo "PM2 not found. Do not npm install on Timeweb." >&2
  echo "Use the existing PM2 from filo or set PM2_BIN in scripts/deploy.env." >&2
  exit 1
}

ensure_pm2_runtime() {
  resolve_pm2_bin "$1"
}

resolve_public_html() {
  : "${DEPLOY_PATH:?DEPLOY_PATH is required}"
  : "${PUBLIC_HTML:=${DEPLOY_PATH}/public_html}"
}

ensure_public_html() {
  local root_dir="$1"
  resolve_public_html

  mkdir -p "${PUBLIC_HTML}"
}

render_public_html_htaccess() {
  local root_dir="$1"
  local template="${root_dir}/public_html/.htaccess.template"

  resolve_public_html

  if [[ ! -f "$template" ]]; then
    template="${root_dir}/public_html/.htaccess"
  fi

  if [[ ! -f "$template" ]]; then
    echo "Warning: Apache proxy template not found in ${root_dir}/public_html." >&2
    return
  fi

  sed "s/__APP_PORT__/${APP_PORT}/g" "$template" > "${PUBLIC_HTML}/.htaccess"

  local php_template="${root_dir}/public_html/index.php.template"
  if [[ -f "$php_template" ]]; then
    sed "s/__APP_PORT__/${APP_PORT}/g" "$php_template" > "${PUBLIC_HTML}/index.php"
  fi

  echo "==> Apache PHP proxy: ${PUBLIC_HTML}/index.php -> 127.0.0.1:${APP_PORT}"
}

load_server_env() {
  local script_dir="$1"
  local env_file="${script_dir}/deploy.env"

  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    source "$env_file"
  fi

  : "${DEPLOY_PATH:=/home/c/cm149295/postvmeste}"
  resolve_public_html
  : "${GIT_BRANCH:=main}"
  : "${GIT_REMOTE:=origin}"
  : "${APP_NAME:=postvmeste}"
  : "${APP_PORT:=3001}"
  : "${NODE_ENV:=production}"
  : "${NPM_CI_ARGS:=--ignore-scripts}"
}

load_deploy_env() {
  local script_dir="$1"
  local env_file="${script_dir}/deploy.env"

  if [[ ! -f "$env_file" ]]; then
    echo "Missing ${env_file}. Copy scripts/deploy.env.example to scripts/deploy.env." >&2
    exit 1
  fi

  # shellcheck disable=SC1090
  source "$env_file"

  : "${SSH_HOST:?SSH_HOST is required}"
  : "${SSH_USER:?SSH_USER is required}"
  : "${SSH_PORT:=22}"
  : "${DEPLOY_PATH:=/home/c/cm149295/postvmeste}"
  resolve_public_html
  : "${GIT_BRANCH:=main}"
  : "${GIT_REMOTE:=origin}"
  : "${APP_NAME:=postvmeste}"
  : "${APP_PORT:=3001}"
  : "${NODE_ENV:=production}"
  : "${NPM_CI_ARGS:=--ignore-scripts}"
}

run_remote() {
  local script_dir="$1"
  shift

  local ssh_target="${SSH_USER}@${SSH_HOST}"
  local -a ssh_opts=(
    -p "${SSH_PORT}"
    -o BatchMode=yes
    -o StrictHostKeyChecking=accept-new
  )

  if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then
    ssh_opts+=(-i "${SSH_IDENTITY_FILE/#\~/$HOME}")
  fi

  ssh "${ssh_opts[@]}" "$ssh_target" "$@"
}

export_remote_env() {
  cat <<EOF
export DEPLOY_PATH='${DEPLOY_PATH}'
export PUBLIC_HTML='${PUBLIC_HTML}'
export GIT_BRANCH='${GIT_BRANCH}'
export GIT_REMOTE='${GIT_REMOTE}'
export APP_NAME='${APP_NAME}'
export APP_PORT='${APP_PORT}'
export NODE_ENV='${NODE_ENV}'
export NODE_BIN='${NODE_BIN:-}'
export NPM_BIN='${NPM_BIN:-}'
export PM2_BIN='${PM2_BIN:-}'
export NPM_CI_ARGS='${NPM_CI_ARGS}'
EOF
}

step() {
  printf '\n==> %s\n' "$1"
}

require_command() {
  local name="$1"
  local hint="$2"

  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: ${name}" >&2
    echo "${hint}" >&2
    exit 1
  fi
}

preflight_deploy_tools() {
  require_command ssh "Install OpenSSH client or use GitHub Actions deploy instead."
  require_command rsync "On Windows install rsync (WSL, cwRsync, or Git for Windows with rsync) or use GitHub Actions."
}
