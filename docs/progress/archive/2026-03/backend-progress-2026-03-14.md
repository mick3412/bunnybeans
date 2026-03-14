# 後端進度紀錄 2026-03-14

> 承接 [backend-progress-2026-03-13.md](backend-progress-2026-03-13.md) 累積項；本日僅追加本檔「本日變更」與快照。

---

## 今日完成（快照）

- **延續 03-13 主線**：POS 全流程、促銷 preview／建單折後 **`totalAmount`**、**GET /finance/events** + **`GET /finance/events/export`**（金流 CSV）、Category CRUD + **enriched**、inventory **events／balances CSV**、**GET /health**、**jest 32 passed**。
- **CI**：`backend-ci.yml`；**e2e.yml** 內 **backend-test** → **playwright**（`needs`）。
- **促銷功能開發計畫（Agent）**：**PromotionRule** + **PromotionEngine**；**promotion-rules** CRUD + reorder；**PosOrder** 折讓欄位與建單串引擎；migration **`20260314180000_promotion_rules_pos_discount`**；seed 範例規則。詳見 **integrated-progress-2026-03-14.md**。
- **Dashboard／POS 報表**（若已併入）：**GET /admin/dashboard/summary**、**GET /pos/reports/summary**。
- **文件**：`api-design.md`、`api-design-inventory-finance.md`、`AGENT-DEV-INSTRUCTIONS.md`、`deploy-preview.md`（部署對齊時請一併查）。

## 卡點

- 無。

## To Do

- 維持 **jest 全綠**；Preview／生產 **db push 或 migrate + seed**（見 `deploy-preview.md`）。
- 生產 **ADMIN_API_KEY** 時，寫入／匯出 API 須 **X-Admin-Key**。
- **P4 下一項**：**A3** `GET /pos/orders/export`（訂單 CSV）；前端可串 **finance/events/export**、**inventory/balances/export**。

## 本日變更紀錄（僅追加）

- 14:12 更新：**今日開發紀錄同步**—後端現況 **jest 16**、§3.2（finance preset、categories enriched、inventory CSV export、E2E workflow）；README 後端列改指向本檔；Notion 日報 **2026-03-14** 已建。
- **整合紀錄**：**促銷模組**（計畫名：促銷功能開發計畫）與 **POS／Dashboard／pos-reports** 已寫入 **notion-daily-2026-03-14.md**、**integrated-progress-2026-03-14.md**。
- 15:22 更新：**TASK-backend-agent-plan-integrated** 本輪—**P0** [deploy-preview.md](deploy-preview.md)（`migrate deploy` 含促銷 migration、後端先 deploy、單一 3003）、[TASK](../../tasks/TASK-backend-agent-plan-integrated.md) 部署順序；**P1** jest 30 綠、e2e **needs**、CORS `origin: true`；**P3** [api-design-pos.md](api-design-pos.md) §1.1 折後 total＝preview、[api-promotion-rules.md](api-promotion-rules.md) 對齊；**P2** seed **E2E 滿百折十** + [db-seed.md](db-seed.md)、**PROMOTION_*** 錯誤碼；促銷整合測試 teardown 修復。
- 15:44 更新：**P4 A1**—先寫 [api-design-inventory-finance.md](../../api-design-inventory-finance.md) §4.2c；**`GET /inventory/balances/export?warehouseId=`**（Admin Key、UTF-8 BOM、最多 1 萬列、欄位 sku/name/productId/warehouseId/onHandQty/updatedAt）；[bulk-import-export-plan.md](../../bulk-import-export-plan.md) 現況表與 Phase A 標 **已做**；整合測試 **exportBalancesCsv**；**jest 31 passed**。
- 15:46 更新：**P4 A2**—[api-design-inventory-finance.md](../../api-design-inventory-finance.md) §5.0b；**`GET /finance/events/export`**（query 同 `GET /finance/events`、含 **preset=last30d**、最多 1 萬列、BOM、Admin Key）；[FinanceRepository.listEventsExport](...)、**exportFinanceEventsCsv** 整合測試；**jest 32 passed**。
