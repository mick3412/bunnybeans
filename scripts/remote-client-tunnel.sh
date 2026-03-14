#!/usr/bin/env bash
# 遠端客戶驗證：後端 Tunnel + 前端（已設 VITE_API_BASE_URL=後端 Tunnel）再開前端 Tunnel
# 客戶只需開「前端」那條 https://xxx.trycloudflare.com 即可完整操作 POS（API 經由後端 Tunnel）
# 前置: brew install cloudflared
# 用法: bash scripts/remote-client-tunnel.sh
# 結束: Ctrl+C

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BACKEND_PORT="${BACKEND_PORT:-3003}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
LOG_API="${TMPDIR:-/tmp}/pos-cf-api-$$.log"
LOG_WEB="${TMPDIR:-/tmp}/pos-cf-web-$$.log"

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
  echo ">>> 關閉中…"
  kill "$BE_PID" 2>/dev/null || true
  kill "$CF_API_PID" 2>/dev/null || true
  kill "$CF_WEB_PID" 2>/dev/null || true
  kill "$FE_PID" 2>/dev/null || true
  kill_port "$BACKEND_PORT"
  kill_port "$FRONTEND_PORT"
  rm -f "$LOG_API" "$LOG_WEB" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "請安裝: brew install cloudflared"
  exit 1
fi

echo ">>> [1/5] 清 port ${BACKEND_PORT} / ${FRONTEND_PORT}"
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

echo ">>> [2/5] 後端 http://127.0.0.1:${BACKEND_PORT}"
pnpm --filter pos-erp-backend dev >> /tmp/pos-backend-remote.log 2>&1 &
BE_PID=$!
for i in $(seq 1 50); do
  curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1 && break
  sleep 0.5
  [[ $i -eq 50 ]] && { echo "後端起不來，見 /tmp/pos-backend-remote.log"; exit 1; }
done

echo ">>> [3/5] API Tunnel（等網址）"
: >"$LOG_API"
cloudflared tunnel --url "http://127.0.0.1:${BACKEND_PORT}" >>"$LOG_API" 2>&1 &
CF_API_PID=$!
API_URL=""
for i in $(seq 1 50); do
  API_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_API" | head -1 || true)
  [[ -n "$API_URL" ]] && break
  sleep 1
done
[[ -z "$API_URL" ]] && { echo "未取得 API Tunnel，見 $LOG_API"; exit 1; }
echo "    API: $API_URL"

echo ">>> [4/5] 前端（VITE_API_BASE_URL=$API_URL，監聽 127.0.0.1）"
export VITE_API_BASE_URL="$API_URL"
pnpm --filter pos-erp-frontend dev >> /tmp/pos-frontend-remote.log 2>&1 &
FE_PID=$!
FE_OK=""
for i in $(seq 1 80); do
  if ! kill -0 "$FE_PID" 2>/dev/null; then
    echo "前端進程已退出，見 /tmp/pos-frontend-remote.log"
    tail -30 /tmp/pos-frontend-remote.log
    exit 1
  fi
  if curl -sf --connect-timeout 2 "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1; then
    FE_OK=1
    break
  fi
  sleep 0.5
done
[[ -z "$FE_OK" ]] && { echo "前端 ${FRONTEND_PORT} 未就緒（cloudflared 會 502）見 /tmp/pos-frontend-remote.log"; tail -25 /tmp/pos-frontend-remote.log; exit 1; }
echo "    前端 http://127.0.0.1:${FRONTEND_PORT}/ 已可連"

echo ">>> [5/5] 網站 Tunnel（給客戶開這條）"
: >"$LOG_WEB"
cloudflared tunnel --url "http://127.0.0.1:${FRONTEND_PORT}" >>"$LOG_WEB" 2>&1 &
CF_WEB_PID=$!
WEB_URL=""
for i in $(seq 1 50); do
  WEB_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_WEB" | head -1 || true)
  [[ -n "$WEB_URL" ]] && break
  sleep 1
done
[[ -z "$WEB_URL" ]] && { echo "未取得網站 Tunnel，見 $LOG_WEB"; exit 1; }

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  給遠端客戶（完整 POS + 後台）"
echo "  $WEB_URL"
echo "  後台: ${WEB_URL}/admin  ｜  POS: ${WEB_URL}/pos"
echo "──────────────────────────────────────────────────────────"
echo "  API 僅供除錯: ${API_URL}/health"
echo "  勿關本視窗；Ctrl+C 會停 Tunnel 與服務。"
echo "══════════════════════════════════════════════════════════"
echo ""

open "$WEB_URL" 2>/dev/null || true
wait "$FE_PID" 2>/dev/null || wait
