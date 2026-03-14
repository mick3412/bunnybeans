#!/usr/bin/env bash
# 重啟本機後端 :3003 + 前端 :5173（背景執行，不開瀏覽器、關閉視窗不會停服）
# 用法: bash scripts/restart-dev-bg.sh
# 停服: bash scripts/restart-dev-bg.sh stop  或  lsof -i :3003 -t | xargs kill

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -i ":$port" -t 2>/dev/null) || true
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
    pids=$(lsof -i ":$port" -t 2>/dev/null) || true
    [[ -n "$pids" ]] && echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
}

if [[ "${1:-}" == "stop" ]]; then
  kill_port 3003
  kill_port 5173
  echo "已停止 3003 / 5173"
  exit 0
fi

echo ">>> 停止舊程序 3003 / 5173"
kill_port 3003
kill_port 5173

if [[ "${RUN_SEED:-}" == "1" ]] && [[ -f backend/.env ]]; then
  echo ">>> migrate deploy + seed（RUN_SEED=1）"
  set -a
  # shellcheck source=/dev/null
  source backend/.env 2>/dev/null || true
  set +a
  if [[ -n "${DATABASE_URL:-}" ]]; then
    pnpm --filter pos-erp-backend exec prisma migrate deploy
    pnpm db:seed || true
  else
    echo "    略過 seed（無 DATABASE_URL）"
  fi
fi

echo ">>> 啟動後端 → /tmp/pos-backend.log"
pnpm --filter pos-erp-backend dev >> /tmp/pos-backend.log 2>&1 &
echo ">>> 啟動前端 → /tmp/pos-frontend.log"
pnpm --filter pos-erp-frontend dev >> /tmp/pos-frontend.log 2>&1 &

for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:3003/health >/dev/null 2>&1 && break
  sleep 0.5
done
echo ">>> 後端 http://localhost:3003 ｜ 前端 http://localhost:5173"
echo "    日誌: tail -f /tmp/pos-backend.log /tmp/pos-frontend.log"
