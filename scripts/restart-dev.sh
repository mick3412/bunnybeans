#!/usr/bin/env bash
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

echo "Starting backend and frontend..."
pnpm --filter pos-erp-backend dev > /tmp/pos-backend.log 2>&1 &
BACKEND_PID=$!
pnpm --filter pos-erp-frontend dev > /tmp/pos-frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for services (4s)..."
sleep 4

echo "Opening Chrome at http://localhost:5173"
open -W -a "Google Chrome" "http://localhost:5173"

echo "Chrome closed. Stopping dev processes..."
kill_port 3003
kill_port 5173
# Also kill the background pnpm children if still running
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true

echo "Closing Terminal window."
osascript -e 'tell application "Terminal" to close front window'
