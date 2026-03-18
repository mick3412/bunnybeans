# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最下方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 常駐指令（測試資料）— 規格 Agent 勿刪

在 **jest／整合測試／手動 API／腳本** 中**新增寫入 DB 的測試用資料**（非既有 seed 劇本）時：**測試結束後（無論通過或失敗）必須刪除該批資料**（`afterEach`／`afterAll`／teardown／手動 DELETE 或 rollback）。例外：刻意留作 fixture 的，須在 spec 註明並用固定前綴／單號，且與 db:seed 劇本不衝突。

---

## 0. 順序

| 項目 | 說明 |
|------|------|
| 有 DB 時 | `migrate deploy` → **`pnpm db:seed`**（會清空業務表，見 [db-seed.md](../db-seed.md)）→ 再跑 jest。 |
| 改 API 時 | 先改 **api-design-***（Loyalty：[api-design-loyalty.md](../api-design-loyalty.md)；採購：[api-design-purchase.md](../api-design-purchase.md)）。 |
| 前端 UI 配合 | 前端視覺依 [frontend-ui-principles.md](../frontend-ui-principles.md)；若前端因 KPI／報表／標籤等需求需**新增或調整回傳欄位**，依 api-design 擴充並於契約註明。 |

---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 追加一筆。  
> 參閱 [erp-roadmap.md](../erp-roadmap.md)。

### 本輪任務（依序完成，全部必做）

> 參考 [progress/integrated-last-cycle.md](../progress/integrated-last-cycle.md)「全局審查缺口清單」，**本輪改以「下一階段能力」為主，不重做上一輪已完成項目**。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸維護（含 DB seed）** | `pnpm --filter pos-erp-backend test` 全綠；有 DB 時依 `db-seed.md` 跑 `pnpm db:seed` 成功；agent-log 追加。 |
| 2 | **報表穿透 2.0：點擊審計（ReportClickAudit）** | 新增一個針對報表穿透的審計機制（表或 log）：記錄來源報表、欄位、referenceId、解析結果 kind、成功與否、時間等，供日後分析「哪些穿透最常用／最常失敗」。補簡要契約與 1～2 則整合測試。 |
| 3 | **CI/Preview 一鍵綠防護：schema / migration 健檢** | 在 CI（或專用 script）補一個「schema drift／migration 可重放」檢查步驟（例如對乾淨 DB 跑特定指令並檢查結果），並在 docs/deploy-preview.md 補上成功條件與失敗訊息對應。 |
| 4 | **Party Phase 2：多方視圖 API 升級** | 在既有 Party 構想上，完成實作：例如 `GET /finance/balances`（或新 endpoint）支援以 Party kind 分頁/聚合，回傳 displayName 與 kind，並補 Party 關聯的 integration-spec。 |
| 5 | **多商家 Phase 2：報表資料隔離＋錯誤態** | 在現有多商家模型基礎上，補 2～3 組整合測試：驗證 Finance / POS / Loyalty 報表在 merchantId 不帶、帶錯、跨商家存取時的行為與錯誤碼，確保資料隔離。 |
| 6 | **Loyalty 活動成效 v2：快照與指標補強** | 在 `GET /loyalty/reports/activity` 基礎上，補充額外指標（例如 ROI、每位會員平均使用次數等）或 snapshot 能力，並補充對應測試與文件，讓前端可做更完整的活動報表。 |
| 7 | **換貨流程 Phase 2：可追蹤性與對帳** | 在已存在的「退貨入庫 + 新單」流程上，補一個可供對帳的關聯（例如 exchangeReference 或 audit log），讓後端能回答「這筆新單來自哪一張換貨舊單」，並補一則整合測試。 |
| 8 | **RBAC（選配）— 概念實驗與 1 條受保護 API** | 不實作完整系統，只先落地最小概念：在 User 或 API token 上加入角色欄位（例如 READ_ONLY），並選 1 條後台寫入 API 示範「僅 Owner 可寫、READ_ONLY 只能讀」，補文件與測試。 |
| 9 | **條碼（Barcode）支援：後端契約正式化** | 針對條碼支援，新增/確認一個穩定的查詢契約（例如 `GET /products/search-barcode?q=`），並讓 `/inventory/events/scan-stocktake` 文檔明確寫出對 barcode 的支援與錯誤碼，補 1～2 則整合測試。 |

---

## 2. 驗收

- [ ] §1 十項依序完成（遇卡點於 agent-log 註明）
- [ ] **迴歸驗收**：`pnpm --filter pos-erp-backend test` 全綠；有 DB 時跑 `pnpm db:seed` 成功
- [ ] agent-log 追加一筆（含 HH:MM）

---

## 3. 禁止

- 規格 Agent 整份重寫本檔（僅可覆寫 §1）。
- 繞過 InventoryEvent 做入庫。
- 測試新增資料不清理（違反上方常駐指令）。

---

## 4. 固定參考

| 用途 | 路徑 |
|------|------|
| **全站 Roadmap（必讀）** | [erp-roadmap.md](../erp-roadmap.md) |
| 前端 UI 原則（配合時參照） | [frontend-ui-principles.md](../frontend-ui-principles.md) |
| Loyalty 契約 | [api-design-loyalty.md](../api-design-loyalty.md)、[crm-loyalty-ui-plan.md](../crm-loyalty-ui-plan.md) |
| 採購 | [api-design-purchase.md](../api-design-purchase.md)、[API-DECISIONS-bulk.md](../API-DECISIONS-bulk.md) |
| 金流／財務 | [finance-accounting-roadmap.md](../finance-accounting-roadmap.md)、[api-design-inventory-finance.md](../api-design-inventory-finance.md) |
| Seed | [db-seed.md](../db-seed.md) |
| 守則與協作 | [AGENT-RULES.md](../AGENT-RULES.md)、[agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md) |

