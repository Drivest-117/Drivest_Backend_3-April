#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ENV="${DEPLOY_ENV:-prod}"
EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_PORT="${EC2_PORT:-22}"
SSH_KEY_PATH="${SSH_KEY_PATH:-${HOME}/.ssh/id_rsa}"
DEPLOY_GIT_SHA="${DEPLOY_GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || true)}"
DEPLOY_GIT_REF="${DEPLOY_GIT_REF:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)}"
DEPLOYED_AT="${DEPLOYED_AT:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
DEPLOY_RUN_ID="${DEPLOY_RUN_ID:-${GITHUB_RUN_ID:-}}"
DEPLOY_RUN_NUMBER="${DEPLOY_RUN_NUMBER:-${GITHUB_RUN_NUMBER:-}}"
APP_VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}"

case "${DEPLOY_ENV}" in
  prod|production)
    DEPLOY_ENV="prod"
    EC2_APP_DIR="${EC2_APP_DIR:-/var/www/drivest-backend}"
    PM2_APP_NAME="${PM2_APP_NAME:-drivest-backend}"
    APP_PORT="${APP_PORT:-3000}"
    ;;
  dev|development)
    DEPLOY_ENV="dev"
    EC2_APP_DIR="${EC2_APP_DIR:-/var/www/drivest-backend-dev}"
    PM2_APP_NAME="${PM2_APP_NAME:-drivest-backend-dev}"
    APP_PORT="${APP_PORT:-3001}"
    ;;
  *)
    echo "Unsupported DEPLOY_ENV: ${DEPLOY_ENV} (expected prod or dev)"
    exit 1
    ;;
esac

if [[ -z "${EC2_HOST}" ]]; then
  echo "EC2_HOST is required"
  exit 1
fi

SSH_OPTS=(
  -p "${EC2_PORT}"
  -o StrictHostKeyChecking=accept-new
)

if [[ -S "${SSH_AUTH_SOCK:-}" ]]; then
  echo "Using SSH agent at ${SSH_AUTH_SOCK}"
elif [[ -f "${SSH_KEY_PATH}" ]]; then
  SSH_OPTS=(
    -i "${SSH_KEY_PATH}"
    "${SSH_OPTS[@]}"
  )
  echo "Using SSH key at ${SSH_KEY_PATH}"
else
  echo "No SSH agent available and SSH key not found at ${SSH_KEY_PATH}"
  exit 1
fi

RSYNC_RSH="ssh ${SSH_OPTS[*]}"
export RSYNC_RSH

echo "Deploy target: ${DEPLOY_ENV}"
echo "Remote app dir: ${EC2_APP_DIR}"
echo "PM2 app name: ${PM2_APP_NAME}"
echo "App port: ${APP_PORT}"
echo "Preparing remote directory ${EC2_APP_DIR} on ${EC2_USER}@${EC2_HOST}:${EC2_PORT}"
ssh "${SSH_OPTS[@]}" "${EC2_USER}@${EC2_HOST}" <<EOF
set -euo pipefail
if [ ! -d "${EC2_APP_DIR}" ]; then
  sudo mkdir -p "${EC2_APP_DIR}"
fi
sudo chown -R "${EC2_USER}:${EC2_USER}" "${EC2_APP_DIR}"
EOF

echo "Syncing repository to ${EC2_APP_DIR}"
rsync -az --delete \
  --exclude '.env' \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  ./ "${EC2_USER}@${EC2_HOST}:${EC2_APP_DIR}"

echo "Running remote install/build/bootstrap/reload"
ssh "${SSH_OPTS[@]}" "${EC2_USER}@${EC2_HOST}" <<EOF
set -euo pipefail
cd "${EC2_APP_DIR}"
if [ ! -f ".env" ]; then
  echo "Missing ${EC2_APP_DIR}/.env for deploy target ${DEPLOY_ENV}"
  echo "Create the environment file on the server before deploying this target."
  exit 1
fi
export PORT="${APP_PORT}"
export APP_ENV="${DEPLOY_ENV}"
export PM2_APP_NAME="${PM2_APP_NAME}"
export APP_VERSION="${APP_VERSION}"
export DEPLOY_GIT_SHA="${DEPLOY_GIT_SHA}"
export DEPLOY_GIT_REF="${DEPLOY_GIT_REF}"
export DEPLOYED_AT="${DEPLOYED_AT}"
export DEPLOY_RUN_ID="${DEPLOY_RUN_ID}"
export DEPLOY_RUN_NUMBER="${DEPLOY_RUN_NUMBER}"
echo "Remote directory: $(pwd)"
echo "Deploy target: ${DEPLOY_ENV}"
echo "Node: $(node -v)"
echo "npm: $(npm -v)"
npm ci
npm run build
npm run db:bootstrap
if pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.cjs --only "${PM2_APP_NAME}" --update-env
else
  pm2 start ecosystem.config.cjs --only "${PM2_APP_NAME}" --update-env
fi
pm2 save
EOF
