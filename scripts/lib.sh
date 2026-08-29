#!/usr/bin/env bash

set -euo pipefail

resolve_bin() {
  local override="$1"
  local fallback="$2"

  if [[ -n "$override" ]]; then
    printf '%s\n' "$override"
    return
  fi

  command -v "$fallback"
}

resolve_public_html() {
  : "${DEPLOY_PATH:?DEPLOY_PATH is required}"
  : "${PUBLIC_HTML:=${DEPLOY_PATH}/public_html}"
}

ensure_public_html() {
  local root_dir="$1"
  resolve_public_html

  mkdir -p "${PUBLIC_HTML}"

  if [[ ! -f "${PUBLIC_HTML}/.htaccess" ]]; then
    if [[ -f "${root_dir}/public_html/.htaccess" ]]; then
      cp "${root_dir}/public_html/.htaccess" "${PUBLIC_HTML}/.htaccess"
    else
      echo "Warning: ${PUBLIC_HTML}/.htaccess is missing." >&2
    fi
  fi
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
  : "${APP_PORT:=3000}"
  : "${NODE_ENV:=production}"
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
  : "${APP_PORT:=3000}"
  : "${NODE_ENV:=production}"
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
EOF
}
