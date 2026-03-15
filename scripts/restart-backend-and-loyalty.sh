#!/usr/bin/env bash
# 重啟後端 :3003 + migrate deploy（Loyalty 等 migration）
# 用法：於 repo 根目錄 ./scripts/restart-backend-and-loyalty.sh
# 需：PostgreSQL 已起、DATABASE_URL 正確（backend/.env 或環境變數）

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

echo "== 釋放 3003 =="
for pid in $(lsof -ti :3003 2>/dev/null); do kill -9 "$pid" 2>/dev/null || true; done
sleep 1

if [[ -z "${DATABASE_URL:-}" ]] && [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "$ROOT/.env" ]]; then
  export DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
  if [[ -n "${DB_HOST:-}" ]]; then
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "請設定 DATABASE_URL 或 backend/.env（含 DB_*）"
  exit 1
fi

echo "== prisma migrate deploy =="
pnpm exec prisma migrate deploy

echo "== 啟動後端 :3003（前景；另開終端可改 nohup）==="
echo "    完成後請開瀏覽器: http://127.0.0.1:5173/admin/loyalty"
exec pnpm dev
