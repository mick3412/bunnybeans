# 上一輪整合（規格 Agent 每輪覆寫）

**本輪對應 INSTRUCTIONS**：**059**（後端／前端皆已收斂並提交）  
**最新 agent-log（以 INSTRUCTIONS 編號為準）**：後端 **059** · 前端 **059**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **INSTRUCTIONS 059 主要進展**：
  - 058 收斂之 `pos-return`／repository 與庫存事件邏輯已與後續調整一併提交；`GET /products` 分頁契約與 `minDaysUntilExpiry` 回歸測試已落地（見 `91d9b54f` 等）。
  - **Ops**：`runJob records OpsJobRunLog` 整合測試改以 `runLogId` 查表驗證，避免並行測試下 `count()` 競態（flaky）。
  - **財務／庫存／POS**：與退換貨、訂單流程相關之服務層調整已併入本輪主提交（`c9d2536f`）。
- **測試**：`pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 全綠。

## 前端（收斂摘要）

- **INSTRUCTIONS 059 主要進展**：
  - **商品列表**：`GET /products` 分頁形狀 `{ items, total, page, pageSize }` 與 mock 對齊。
  - **POS**：購物車庫存警示僅在超賣時提示；結帳成功清空購物車；「最新訂單」可連結至明細。
  - **後台**：商品總覽移除頁內 Admin Key；庫存總覽整併「倉庫/門市」「入庫」為頁內 Tab。
  - **共用**：`PartySearchSelect` 預覽簡化 customerId；側欄／售後頁「退換貨」文案一致。
  - **售後明細**：`AfterSalesPanel`／`PosOrderDetailPage` 等互動與 API 串接補強。
  - **E2E／文件**：售後三支 spec 與 `docs/e2e-pos.md` 補完；修復 `pos-exchange-settlement-journey.spec.ts` 結尾括號。
- **測試**：`pnpm --filter pos-erp-frontend build` 全綠；指定售後 E2E 可執行，**本機未設 `E2E_PROFILE=full` 或缺 e2e-seed 可售庫存時仍可能全數 skip**（屬環境前置，非程式阻擋）。

---

## 059 主題：058 收斂 + POS 售後／契約／UX 一併落地

| 項目 | 狀態 |
|------|------|
| 後端 #1 補齊 commit / 058 殘差 | 完成（含 `c9d2536f`） |
| 後端 #2 商品列表契約凍結 | 完成 |
| 後端 #3 效期篩選與分頁回歸 | 完成 |
| 後端 ops runJob 測試穩定 | 完成 |
| 前端 #1～#10 | 完成（含「退換貨」文案） |

---

## 整合風險／待對齊

| 項目 | 說明 |
|------|------|
| 售後 E2E skip | 需 **`E2E_PROFILE=full`** 並執行 **`pnpm --filter pos-erp-backend e2e:seed`**（或依 `docs/e2e-pos.md`）才可期望三支 spec 實跑而非全 skip。 |
| 財務文件與實作 | `GET /finance/balances` 已實作但 roadmap／api-design 敘述需持續對齊（見下方全局缺口）。 |

---

## 全局審查缺口清單（059 後剩餘）

### 已收斂（059）

| 來源 | 狀態 |
|------|------|
| 商品列表分頁與效期欄位／篩選 | 後端測試 + 前端契約對齊已落地 |
| POS 售後主要 UX（退換貨文案、結帳後狀態） | 已落地 |
| Ops `runJob` 整合測試 flaky | 已改為 `runLogId` 驗證 |

### 待處理（建議下一輪 060）

| 來源 | 缺口 | 優先 |
|------|------|------|
| erp-roadmap §0.3 | Finance balances：**API 已存在**，需補齊契約文件、`finance-accounting-roadmap.md` §9 狀態與測試敘述一致 | 高 |
| erp-roadmap §0.6 | Loyalty 存摺 tab 仍顯示英文 enum，需改中文 | 中 |
| E2E | 售後三支 spec 在一般環境易全 skip；需 **full profile 驗證路徑**或 CI 明文化 | 中 |
| erp-roadmap Phase 1 | Product schema 擴充（`specCapacity` 等）、ProductTag 後端 master | 中長期 |

### 中長期缺口（roadmap）

| 來源 | 缺口 | 說明 |
|------|------|------|
| erp-roadmap Phase 2+ | Party 視圖、補貨閉環進階、行銷成效 | 待排程 |
| ops-roadmap | Job 監控可觀測性 | 需搭配流量與前端監控頁 |

---

## 已開發模組進度

| 模組 | 後端 | 前端 | 備註 |
|------|------|------|------|
| 商品總覽（分頁／效期） | 完成 | 完成 | 契約測試已補 |
| POS 售後（退換貨／明細面板） | 完成 | 完成 | E2E 依環境可能 skip |
| Ops jobs | 完成 | — | runJob 測試已穩定化 |

---

本檔為**實際進度總結**，下一輪具體任務見 [tasks/instructions/](../tasks/instructions/)（目前最新為 **INSTRUCTIONS 060**）§1。
