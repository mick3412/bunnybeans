#!/usr/bin/env bash
# 僅重啟後端與前端，不開啟瀏覽器、不結束後殺掉。
# 適合 E2E 測試或 Cursor Agent 自動化。用法：bash scripts/restart-dev-detach.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -i ":$port" -t 2>/dev/null) || true
  if [[ -n "$pids" ]]; then
    echo "Killing process(es) on port $port: $pids"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
    pids=$(lsof -i ":$port" -t 2>/dev/null) || true
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

echo "Stopping existing dev processes..."
kill_port 3003
kill_port 5173

echo "Starting backend and frontend (detached)..."
pnpm --filter pos-erp-backend dev > /tmp/pos-backend.log 2>&1 &
pnpm --filter pos-erp-frontend dev > /tmp/pos-frontend.log 2>&1 &

echo "Waiting for services (4s)..."
sleep 4

echo "Backend :3003 / Frontend :5173 ready. Logs: /tmp/pos-backend.log, /tmp/pos-frontend.log"
