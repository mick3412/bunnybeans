# 上一輪整合（規格 Agent 每輪覆寫）

**最新 agent-log**：後端 **2026-03-16 16:45**、**2026-03-12 22:10** · 前端 **2026-03-14 22:11**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **採購 Phase1**：Supplier／PO／ReceivingNote API；**complete** → **PURCHASE_IN**（合格數）；migration `20260316120000_*`。
- **採購 Phase2**：驗收 complete 後 **PURCHASE_PAYABLE**；**purchase.integration-spec**（無表則 skip）。
- **SEED 重寫**：**wipeAll** 後單一劇本—**會員 6**、**供應商 4**、PO／RN 全狀態、**POS 2 單**、促銷、BulkJob；**db-seed.md** 已更新。**新庫須 migrate deploy 再 seed**。

## 前端（收斂摘要）

- **採購三頁**：側欄三連結；**契約對齊**（無 APPROVED）；**真 API** + loading／toast／重試／空態；完成驗收 refetch。
- **批量**：async job **failed** 凸顯 **error**（選配已做）。

## 風險／待對齊

- **Seed 後商品 SKU 改為 DEMO-***：若 E2E／手測仍寫死舊 SKU 需改為 **GET 商品** 或新 SKU（目前 e2e 無 CLOTH 字串）。
- **jest 基線**：migrate + seed 後再跑全綠並於 agent-log 寫明 passed 數。

## 下一輪 §1

- [BACKEND-INSTRUCTIONS.md](../tasks/BACKEND-INSTRUCTIONS.md) §1  
- [FRONTEND-INSTRUCTIONS.md](../tasks/FRONTEND-INSTRUCTIONS.md) §1  
