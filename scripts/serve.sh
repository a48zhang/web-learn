#!/usr/bin/env bash
# Serve all pre-built products (frontend + backend services). No build step.
# Usage: ./scripts/serve.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE" >&2
  exit 1
fi

export DOTENV_CONFIG_PATH="$ENV_FILE"

# Verify backend dist entry points
SERVICES=(registry auth gateway topic-space ai)
for svc in "${SERVICES[@]}"; do
  entry="$ROOT_DIR/services/$svc/dist/index.js"
  if [ ! -f "$entry" ]; then
    echo "Error: $entry not found. Run 'pnpm build:services' first." >&2
    exit 1
  fi
done

# Verify frontend dist
if [ ! -f "$ROOT_DIR/frontend/dist/index.html" ]; then
  echo "Error: frontend/dist/index.html not found. Run 'pnpm build:frontend' first." >&2
  exit 1
fi

# Source .env for port numbers
set -a
source "$ENV_FILE"
set +a

REGISTRY_PORT="${REGISTRY_PORT:-3010}"
AUTH_PORT="${AUTH_PORT:-3001}"
TOPIC_SPACE_PORT="${TOPIC_SPACE_PORT:-3002}"
AI_PORT="${AI_PORT:-3003}"
GATEWAY_PORT="${GATEWAY_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

echo "Serving all built products..."
echo "  registry:      :$REGISTRY_PORT"
echo "  auth:          :$AUTH_PORT"
echo "  topic-space:   :$TOPIC_SPACE_PORT"
echo "  ai:            :$AI_PORT"
echo "  gateway:       :$GATEWAY_PORT"
echo "  frontend:      :$FRONTEND_PORT"
echo ""

npx concurrently \
  --names "registry,auth,topic-space,ai,gateway,frontend" \
  --prefix-colors "cyan,yellow,green,magenta,blue,red" \
  --kill-others-on-fail \
  "DOTENV_CONFIG_PATH=$ENV_FILE node $ROOT_DIR/services/registry/dist/index.js" \
  "DOTENV_CONFIG_PATH=$ENV_FILE node $ROOT_DIR/services/auth/dist/index.js" \
  "DOTENV_CONFIG_PATH=$ENV_FILE node $ROOT_DIR/services/topic-space/dist/index.js" \
  "DOTENV_CONFIG_PATH=$ENV_FILE node $ROOT_DIR/services/ai/dist/index.js" \
  "DOTENV_CONFIG_PATH=$ENV_FILE node $ROOT_DIR/services/gateway/dist/index.js" \
  "pnpm --filter @web-learn/frontend preview --port $FRONTEND_PORT"
