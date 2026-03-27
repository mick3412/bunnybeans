#!/usr/bin/env bash
# 一鍵 E2E（隔離 DB）：使用 .env.e2e 指向獨立資料庫，避免清到 demo DB
#
# 用法：
#   cp .env.e2e.example .env.e2e
#   ./scripts/e2e-one-click-isolated.sh
#
# 說明：
# - 會執行 migrate deploy + db:seed + e2e:seed（db:seed 會 wipeAll 清空業務表）
# - 會在背景啟動 backend（:3003）
# - 會跑 Playwright（前端 Vite :5173 會 reuseExistingServer）
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# 載入常見環境變數（不覆蓋已設定的）
load_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f" 2>/dev/null || true
  set +a
}

# 先載入隔離環境（讓 DATABASE_URL 指向 E2E DB）
load_env "$ROOT/.env.e2e"
load_env "$ROOT/backend/.env.e2e"
# 再載入一般 .env（作為 fallback，不覆蓋已設定的 DATABASE_URL）
load_env "$ROOT/.env"
load_env "$ROOT/backend/.env"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "錯誤：DATABASE_URL 未設定。請建立 .env.e2e（見 .env.e2e.example），指向獨立的 E2E DB。"
  exit 1
fi

echo "== 準備隔離 DB（migrate + db:seed + e2e:seed）=="
bash "$ROOT/scripts/e2e-prepare-db.sh"

BACKEND_PID=""
cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "== 可關閉背景後端：kill $BACKEND_PID（或留著繼續開發）=="
  fi
}
trap cleanup EXIT

wait_health() {
  local i
  for i in $(seq 1 90); do
    if curl -sf "http://localhost:3003/health" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! curl -sf "http://localhost:3003/health" >/dev/null; then
  echo "== 後端未回應，嘗試背景啟動（使用隔離 DB 的 DATABASE_URL）=="
  (cd "$ROOT/backend" && pnpm dev >/tmp/pos-e2e-backend.log 2>&1) &
  BACKEND_PID=$!
  echo "後端 PID $BACKEND_PID，日誌 /tmp/pos-e2e-backend.log"
  if ! wait_health; then
    echo "後端 90 秒內未就緒。請檢查：DATABASE_URL 是否指向可連線的 E2E DB。"
    echo "日誌尾端："
    tail -20 /tmp/pos-e2e-backend.log || true
    exit 1
  fi
  echo "後端已就緒"
else
  echo "後端已在執行（確認它使用的是 E2E DB，而不是 demo DB）"
fi

pnpm exec playwright install chromium 2>/dev/null || true
echo "== 跑 Playwright E2E =="
pnpm e2e

echo ""
echo "== 完成（本次所有 seed/E2E 都在隔離 DB 內進行）=="

