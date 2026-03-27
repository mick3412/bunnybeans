# 上一輪整合（規格 Agent 每輪覆寫）

**本輪對應 INSTRUCTIONS**：**061**（後端：共購分析／seed-e2e／文件；前端見 agent-log-frontend）  
**最新 agent-log（以 INSTRUCTIONS 編號為準）**：後端 **061** · 前端 **061**（若尚未追加則以前一輪為準）  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **INSTRUCTIONS 060（前輪）**：`GET /finance/balances` 契約與測試；`wipeAll` 先刪 `posReturn`；`ci:backend-with-db` 綠。
- **INSTRUCTIONS 061 主要進展**：
  - **共購分析**：`GET /pos/reports/market-basket` 收斂（`promoFilter`、`limit`、`minSupport`、DTO）；`api-design-pos.md` §4.4 補契約；`pos-reports.integration-spec` 補 C(3,2)、空區間、minSupport／limit 迴歸。
  - **E2E／seed**：full `e2e:seed` 在補貨建議驗證後還原條碼品項 `InventoryBalance`，降低售後類 Playwright 之 `INVENTORY_INSUFFICIENT`；`seed.ts` `wipeAll` 補 FK 順序註解；demo seed 可選大量共購樣本訂單。
  - **其它**：`GET /finance/events/export` CSV 增 **`orderNumber`** 欄（由 `referenceId` 解析 POS 單號）。
- **測試**：以本輪 agent-log 最新條目之 jest／ci 結果為準。
- **追溯**：[共購分析開發實作](14f5c10d-0865-4a19-82e1-1900b5883e6b)。

## 前端（收斂摘要）

- **INSTRUCTIONS 060 主要進展（log 最新條目）**：
  - 訂單/退換貨入口整併，舊 `after-sales` 路由轉址至訂單頁 tab。
  - 退換貨列表欄位與互動補強（原訂單/退換貨訂單、退貨單號連結）、移除長期空白 tab。
  - 訂單明細補門市名稱（fallback ID）與促銷折扣細節；Loyalty 顯示中文化補漏。
  - E2E 隔離流程改採 `.env.e2e`，並在 full profile 下達成「非全 skip」最小驗收。
- **測試**：`pnpm --filter pos-erp-frontend build` ✅；指定售後 E2E `1 passed / 2 skipped`（仍有 `INVENTORY_INSUFFICIENT` 前置依賴）。
- **追溯補記**：已在 log 補上 [共購分析開發實作](14f5c10d-0865-4a19-82e1-1900b5883e6b) 與 [退換貨系統修復補強](fb81d243-90b1-4dce-9af1-dc0dda8b5912)。

---

## 060 主題：財務契約收斂 + POS 訂單/退換貨頁整併

| 項目 | 狀態 |
|------|------|
| 後端 #1 Finance balances 契約與測試 | 完成 |
| 後端 seed wipeAll 相容性 | 完成 |
| 前端 #1 E2E 非全 skip 驗收 | 完成（仍有條件式 skip） |
| 前端 #2 Loyalty 中文顯示 | 完成（log 記載） |
| 前端 #3～#11（UI/文案/欄位調整） | 多數已完成，待統一提交與最終回歸 |

---

## 整合風險／待對齊

| 項目 | 說明 |
|------|------|
| 前端 060 收斂提交 | agent-log 註記「commits: 待提交」，需在前端對話窗收斂 atomic commits，避免「已做未記錄」落差。 |
| 售後 E2E 庫存前置 | full `e2e:seed` 已還原條碼品項庫存（061）；若仍 skip 請查 `.env.e2e` 與 seed 成敗。 |
| 共購分析（Market Basket） | 後端已收斂；前端／Playwright 待各自 agent-log 提交。 |

---

## 全局審查缺口清單（060 後剩餘）

### 已收斂（060）

| 來源 | 狀態 |
|------|------|
| erp-roadmap §0.3 Finance balances 契約落差 | 已收斂 |
| ci:backend-with-db seed P2003 | 已收斂 |
| POS 訂單/退換貨命名與整併主線 | 前端主線已落地（待提交收斂） |

### 待處理（建議下一輪 061）

| 來源 | 缺口 | 優先 |
|------|------|------|
| 前端 060 待提交 | 針對 #3～#11 產出最終 atomic commits 與對應驗收紀錄（build/E2E） | 高 |
| e2e-pos 與 seed 流程 | 將 `E2E_PROFILE=full` + `.env.e2e` + fixture 一致性落成固定腳本與可重現檢查清單 | 高 |
| 共購分析功能（14f transcript） | 後端已文件化／測試收斂（061）；前端頁面與 E2E 正式提交 | 中 |
| erp-roadmap §0.1/0.2 | Product schema 進一步收斂與 ProductTag 主檔閉環（跨端） | 中 |

### 中長期缺口（roadmap）

| 來源 | 缺口 | 說明 |
|------|------|------|
| erp-roadmap Phase 2+ | Party 視圖升級、補貨閉環進階、行銷活動成效 | 待排程 |
| ops-roadmap | 監控可觀測性與 click-audit 成效收斂 | 需配合真實流量檢驗 |

---

## 已開發模組進度

| 模組 | 後端 | 前端 | 備註 |
|------|------|------|------|
| Finance balances | 完成 | 完成 | 契約、roadmap、測試對齊 |
| POS 訂單/退換貨整併 | — | 進行中（主線已做） | 待提交收斂 |
| 共購分析（Market Basket） | **已完成（061）** | 進行中（前端頁面／路由） | 後端 API、契約、integration-spec；E2E 頁面見前端 |

---

本檔為**實際進度總結**，下一輪具體任務見 [tasks/instructions/](../tasks/instructions/)（目前最新將更新為 **INSTRUCTIONS 061**）§1。
