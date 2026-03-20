#!/usr/bin/env bash
# E2E 所需 DB 前置：migrate + db:seed + e2e:seed
# 適合 Cursor Agent 或 CI 在跑 E2E 前自動準備。用法：bash scripts/e2e-prepare-db.sh
# 需 DATABASE_URL（專案根或 backend/.env）。db:seed 會清空業務資料。
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 載入 .env（不覆蓋已設定）
load_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f" 2>/dev/null || true
  set +a
}
load_env "$ROOT/.env"
load_env "$ROOT/backend/.env"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "錯誤：DATABASE_URL 未設定。請在 .env 或 backend/.env 設定。"
  exit 1
fi

echo "== migrate deploy =="
pnpm --filter pos-erp-backend exec prisma migrate deploy

echo "== db:seed（會清空業務資料）=="
pnpm db:seed

echo "== e2e:seed（掛帳/條碼等 E2E fixture）=="
if [[ "${E2E_PROFILE:-}" == "full" ]]; then
  E2E_PROFILE=full pnpm e2e:seed
else
  pnpm e2e:seed
fi

echo "== DB seed 就緒 =="
