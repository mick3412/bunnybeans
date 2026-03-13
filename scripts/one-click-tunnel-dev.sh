#!/usr/bin/env bash
# 一鍵：後端 :3003 → Cloudflare Tunnel → 自動帶入 VITE_API_BASE_URL → 前端 :5173
# 免手動複製網址、免改 Vercel（本機開 localhost:5173 即連 Tunnel 後端）。
# 雙擊 OneClickTunnelDev.command 或：bash scripts/one-click-tunnel-dev.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BACKEND_PORT="${BACKEND_PORT:-3003}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
CF_LOG="${TMPDIR:-/tmp}/pos-cloudflared-$$.log"

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

cleanup() {
  echo ""
  echo ">>> 正在關閉後端、Tunnel、前端…"
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$CF_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  kill_port "$BACKEND_PORT"
  kill_port "$FRONTEND_PORT"
  rm -f "$CF_LOG" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "請先安裝: brew install cloudflared"
  exit 1
fi

echo ">>> [1/4] 清掉舊程序 (${BACKEND_PORT} / ${FRONTEND_PORT})"
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

echo ">>> [2/4] 啟動後端 http://127.0.0.1:${BACKEND_PORT}"
pnpm --filter pos-erp-backend dev >> /tmp/pos-backend-oneclick.log 2>&1 &
BACKEND_PID=$!

for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    echo "    後端已就緒"
    break
  fi
  sleep 0.5
  if [[ $i -eq 40 ]]; then
    echo "後端起不來，請看 /tmp/pos-backend-oneclick.log"
    exit 1
  fi
done

echo ">>> [3/4] 啟動 Cloudflare Tunnel（解析網址中，約 5～20 秒）"
: > "$CF_LOG"
cloudflared tunnel --url "http://127.0.0.1:${BACKEND_PORT}" >>"$CF_LOG" 2>&1 &
CF_PID=$!

TUNNEL_URL=""
for i in $(seq 1 45); do
  TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -1 || true)
  if [[ -n "$TUNNEL_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$TUNNEL_URL" ]]; then
  echo "拿不到 Tunnel 網址，請看: $CF_LOG"
  exit 1
fi

echo "    Tunnel: $TUNNEL_URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  手機／遠端測 API 請開: ${TUNNEL_URL}/health"
echo "  本機 POS 請開: http://localhost:${FRONTEND_PORT}（已自動連到此 Tunnel）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo ">>> [4/4] 啟動前端（VITE_API_BASE_URL 已設為 Tunnel）"
export VITE_API_BASE_URL="$TUNNEL_URL"
pnpm --filter pos-erp-frontend dev >> /tmp/pos-frontend-oneclick.log 2>&1 &
FRONTEND_PID=$!

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

sleep 1
open "http://localhost:${FRONTEND_PORT}/" 2>/dev/null || true

echo ""
echo "已開啟瀏覽器。關閉請在此視窗按 Ctrl+C（會一併停後端、Tunnel、前端）。"
echo ""

# 保持執行直到 Ctrl+C
wait "$FRONTEND_PID" 2>/dev/null || wait
