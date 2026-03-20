# E2E 環境檢查報告

> 執行時間：依 `pnpm db:seed`、`pnpm e2e:seed`、後端狀態檢查

## 1. db:seed ✅

```bash
pnpm db:seed
```

- **結果**：Seed OK
- **內容**：完整 demo（Merchant M001、門市、商品含 DEMO-BOWL-S「食盆 小」等）
- **說明**：商品來自 `backend/prisma/seed.ts`，E2E 需此步驟才會有 `pos-product-*` 與「食盆 小」

## 2. e2e:seed ✅

```bash
pnpm e2e:seed
```

- **結果**：E2E seed OK
- **內容**：Customer e2e00001…、POS order、ReceivingNote E2E-RN-0001、條碼 E2E-BC-0001
- **說明**：admin-receiving-notes-smoke、admin-barcode-min 等需此 fixture

## 3. 後端狀態 ❌（檢查當下）

```bash
curl -sf http://localhost:3003/health
```

- **結果**：無回應（backend down）
- **影響**：
  - POS 商品：API 失敗時會用 mock（`pos-product-p1`…），理論上仍可點選
  - 條碼：`searchProductsByBarcode` 會失敗，無法驗證端對端
  - receiving-notes：退回供應商 API 需 3003

## 4. 前端商品載入邏輯

- **PosPage** 使用 `posOrdersApi.getProducts()`
- API 成功 → 使用 seed 商品（含 `pos-product-{uuid}`）
- API 失敗 → `apiProducts = null` → 使用 `mockProducts`（`pos-product-p1` ~ `pos-product-p16`）
- **結論**：無論 API 成敗，都應有 `[data-testid^="pos-product-"]` 元素

## 5. 條碼輸入框

- **位置**：PosPage L452，`data-testid="e2e-pos-barcode-input"`
- **顯示條件**：與商品 grid 同區塊，無明顯條件隱藏
- **推測**：Lazy 載入或網路延遲導致元素晚出現，可再加大 timeout 或補等待

## 6. 建議 E2E 執行前檢查

```bash
# 1. 後端
curl -sf http://localhost:3003/health && echo " OK" || echo " 請先 pnpm --filter pos-erp-backend dev"

# 2. 前端（若 reuseExistingServer）
curl -sf -o /dev/null -w "%{http_code}" http://localhost:5173/ && echo " OK" || echo " 請先 pnpm --filter pos-erp-frontend dev"

# 3. Seed
pnpm db:seed && pnpm e2e:seed
```

## 7. 建議執行流程

1. 啟動後端：`pnpm --filter pos-erp-backend dev`
2. 啟動前端：`pnpm --filter pos-erp-frontend dev`（或依 playwright 設定使用既有 server）
3. 執行 seed：`pnpm db:seed && pnpm e2e:seed`
4. 跑 E2E：`CI= pnpm e2e -- e2e/...`
