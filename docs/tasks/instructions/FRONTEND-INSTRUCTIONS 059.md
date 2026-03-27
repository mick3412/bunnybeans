# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 059** 追加一筆。

### 前置（必做，快檢查）

- **工作區與依賴檢查**：先看 `git status` / `git diff`，確認本輪起點與未提交項目；同時確認前端驗收所需環境可啟動（dev server、fixture、env）。
- **先做最小可行驗證**：先跑關鍵 smoke（例：`pnpm --filter pos-erp-frontend build` 或 `pnpm exec playwright test e2e/pos-refund.spec.ts`），避免做到一半才發現環境阻塞。

### 本輪任務（058 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **商品列表契約對齊驗收** | 針對 `GET /products` 分頁回應 `{ items, total, page, pageSize }` 進行前端驗收，確認商品總覽與 POS 商品載入都不會因回應形狀差異顯示空資料。 |
| 2 | **售後 E2E fixture 穩定化** | 針對 `e2e/pos-refund.spec.ts`、`e2e/pos-return-stock.spec.ts`、`e2e/pos-exchange-settlement-journey.spec.ts`，補齊可重現驗收條件（full fixture 或明確 skip 條件），降低環境差異造成的非預期 skip。 |
| 3 | **售後驗收文件補完** | 在測試說明或相關文件中補上 `reuseExistingServer`、port 5173 衝突處理、以及 `INVENTORY_INSUFFICIENT` 時的操作指引（seed/full profile 要求），讓後續驗收可直接照做。 |
| 4 | **POS 購物車庫存警示時機調整** | 以「可買 3 件」為例：數量=3 時不顯示紅色警示；只有當使用者嘗試加到第 4 件（超過上限）才提示「庫存不足，最多可購買 3 件」。 |
| 5 | **結帳成功後自動清空購物車** | 完成結帳建立訂單後，自動清空購物車並回到可直接開始下一筆訂單的狀態（ready for next order）。 |
| 6 | **結帳後最新訂單可點連結** | 文案由「最近單號」改為「最新訂單」；後方訂單編號需可點擊，直接導向該筆訂單明細頁。 |
| 7 | **商品總覽移除 Admin Key 輸入區塊** | `商品總覽` 頁面不再顯示 `Admin Key` 輸入/保存/清除 UI；頁面維持乾淨，權限行為回歸既有環境設定（`VITE_ADMIN_API_KEY`）。 |
| 8 | **庫存總覽整併頁內 Tab** | 將側欄「倉庫/門市」與「入庫 / 盤點」移入「庫存總覽」頁內 tab，並將「入庫 / 盤點」文案改為「入庫」。 |
| 9 | **對象下拉預覽簡化 partyId 顯示** | 在「對象」下拉式預覽中，將 `CUSTOMER:...` 顯示改為僅顯示 customerId 前 5 碼 + `...`（移除 `CUSTOMER:` 前綴）。 |
| 10 | **「售後服務」改名為「退換貨」** | 將側欄、頁首、區塊標題等使用者可見文案中的「售後服務」統一改為「退換貨」（路由路徑／程式識別名可維持不變，僅改顯示文字）。 |

### 任務執行中（每項必做）

- **最小驗收即時跑**：每完成一個任務就跑對應最小驗收（例如單支 E2E、局部 build 或相關頁面手動驗證），不要全部堆到最後才驗。

### 收尾（必做，完整驗收）

- **完整回歸**：`pnpm --filter pos-erp-frontend build` 全綠；本輪指定 E2E 需完成或明確註記 skip 條件與原因。
- **E2E skip 紀錄格式（必填）**：若有 skip，於 agent-log 以 `spec 檔名 + skip code + 前置條件 + 解法` 固定格式記錄（例：`pos-return-stock.spec.ts | INVENTORY_INSUFFICIENT | 缺 full fixture | 執行 pnpm e2e:seed --profile full`）。
- **提交與紀錄**：再次檢查 `git status` / `git diff`；有變更必提交 atomic commits，並在 agent-log 列出 sha + message；若無變更需註記「無需 commit（無工作區變更）」。

---
