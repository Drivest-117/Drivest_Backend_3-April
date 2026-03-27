#!/usr/bin/env bash
set -euo pipefail

EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_PORT="${EC2_PORT:-22}"
EC2_APP_DIR="${EC2_APP_DIR:-/var/www/drivest-backend}"
SSH_KEY_PATH="${SSH_KEY_PATH:-${HOME}/.ssh/id_rsa}"
DEPLOY_GIT_SHA="${DEPLOY_GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || true)}"
DEPLOY_GIT_REF="${DEPLOY_GIT_REF:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)}"
DEPLOYED_AT="${DEPLOYED_AT:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
DEPLOY_RUN_ID="${DEPLOY_RUN_ID:-${GITHUB_RUN_ID:-}}"
DEPLOY_RUN_NUMBER="${DEPLOY_RUN_NUMBER:-${GITHUB_RUN_NUMBER:-}}"
APP_VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}"

if [[ -z "${EC2_HOST}" ]]; then
  echo "EC2_HOST is required"
  exit 1
fi

if [[ ! -f "${SSH_KEY_PATH}" ]]; then
  echo "SSH key not found at ${SSH_KEY_PATH}"
  exit 1
fi

SSH_OPTS=(
  -i "${SSH_KEY_PATH}"
  -p "${EC2_PORT}"
  -o StrictHostKeyChecking=accept-new
)

RSYNC_RSH="ssh ${SSH_OPTS[*]}"
export RSYNC_RSH

rsync -az --delete \
  --exclude '.env' \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  ./ "${EC2_USER}@${EC2_HOST}:${EC2_APP_DIR}"

ssh "${SSH_OPTS[@]}" "${EC2_USER}@${EC2_HOST}" <<EOF
set -euo pipefail
cd "${EC2_APP_DIR}"
export APP_VERSION="${APP_VERSION}"
export DEPLOY_GIT_SHA="${DEPLOY_GIT_SHA}"
export DEPLOY_GIT_REF="${DEPLOY_GIT_REF}"
export DEPLOYED_AT="${DEPLOYED_AT}"
export DEPLOY_RUN_ID="${DEPLOY_RUN_ID}"
export DEPLOY_RUN_NUMBER="${DEPLOY_RUN_NUMBER}"
npm ci
npm run build
npm run db:bootstrap
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
EOF
