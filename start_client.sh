#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure the backend network exists before starting the client
if ! docker network inspect ai-cpu-stack_default >/dev/null 2>&1; then
  echo "Error: Docker network 'ai-cpu-stack_default' not found."
  echo "Please run ./start-api.sh first so the backend stack creates the shared network."
  exit 1
fi

echo "Building and starting React client..."
docker compose -f docker-compose.client.yml up -d --build

echo "React test console is running at http://localhost:3000"
