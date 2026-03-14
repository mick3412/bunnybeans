#!/usr/bin/env bash
# 盤點 CSV import 示範：需先 pnpm db:seed（會建立 SKU-DEMO-CSV-IMPORT + 倉 W001）
# 用法：export ADMIN_API_KEY=你的key（若後端有設）；BASE_URL 預設 http://localhost:3003
set -e
BASE_URL="${BASE_URL:-http://localhost:3003}"
DEMO_SKU="SKU-DEMO-CSV-IMPORT"
DEMO_WH_CODE="W001"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
printf 'sku,warehouseCode,quantityDelta\n%s,%s,1\n' "$DEMO_SKU" "$DEMO_WH_CODE" > "$TMP"

echo "CSV 內容："
cat "$TMP"
echo ""
# 優先單段 URL（與 events/import 同實作）；若仍 404 請重啟後端: cd backend && pnpm dev
PATH_IMPORT="${PATH_IMPORT:-$BASE_URL/inventory/import}"
echo "POST $PATH_IMPORT"
if [[ -n "${ADMIN_API_KEY:-}" ]]; then
  curl -s -w "\nHTTP %{http_code}\n" -X POST "$PATH_IMPORT" \
    -H "X-Admin-Key: $ADMIN_API_KEY" \
    -F "file=@$TMP;type=text/csv"
else
  curl -s -w "\nHTTP %{http_code}\n" -X POST "$PATH_IMPORT" \
    -F "file=@$TMP;type=text/csv"
fi
echo ""
echo "預期 JSON：ok>=1、referenceId 為 uuid；餘額在 W001 該 sku 會 +1"
