#!/usr/bin/env bash
set -euo pipefail

EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_PORT="${EC2_PORT:-22}"
EC2_APP_DIR="${EC2_APP_DIR:-/var/www/drivest-backend}"
SSH_KEY_PATH="${SSH_KEY_PATH:-${HOME}/.ssh/id_rsa}"

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
npm ci
npm run build
npm run db:bootstrap
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
EOF
