# 上一輪整合（規格 Agent 每輪覆寫）

**最新 agent-log**：後端 **2026-03-19 22:45** · 前端 **2026-03-17 00:35**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **回歸**：`pnpm --filter pos-erp-backend test` 多輪維持全綠（最近條目已達 80+ tests、含多模組 integration-spec）。  
- **一鍵綠與 DB 初始化策略**：針對 migrate P3009／舊 migration 可重放性問題，已形成「乾淨 DB 可 `migrate deploy → db:seed → test`」與 fallback（`db push → seed → test`）的策略描述，並有 baseline/squash 方向（實際落地狀態以 migration 檔案為準）。  
- **Phase 1/2 主要能力已齊**：Product 規格欄位擴充、ProductTag CRUD、Inventory 批次/效期與補貨建議、補貨→PO 草稿、POS 報表、促銷成效、滯銷品、批次改價、多品盤點、操作捷徑、Loyalty/CRM（含分群、發券規則、活動報表）、Ops job 監控 API 等均已上線並有測試覆蓋。

## 前端（收斂摘要）

- **回歸**：`pnpm --filter pos-erp-frontend build` 多輪維持全綠。  
- **Phase 1/2 主要 UI 已齊**：後台 UI 已全面對齊 `frontend-ui-principles.md`；商品規格五欄、ProductTag 改接 API、補貨閉環、POS 報表（含 E2E 規格）、金流報表（type/partyId/summary/圖表雛形）、Ops job 監控頁、會員/CRM（主檔 2.0、合併、互動紀錄、分群匯出、發券規則）等均已具備或完成原型。  
- **E2E**：多數 spec 需 **DB + ADMIN_API_KEY**；本機常見卡點為 5173 port 佔用或 Playwright 瀏覽器環境，建議以 CI 或專用聯調環境定期跑完整 suite。

---

## 已開發模組進度

| 模組 | 後端 | 前端 | 備註 |
|------|------|------|------|
| Merchant | list、GET /merchant/current | 單一商家（useDefaultMerchantId） | 完成 |
| Product / Category / Brand / ProductTag | CRUD、import CSV、ProductTag CRUD | 列表、抽屜、import、分類維護、標籤接 API；UI 對齊 | 完成 |
| Inventory | events、balances、批次／效期、replenishment-suggestions | 庫存頁、匯出／盤點匯入、補貨建議 UI | 完成；補貨閉環已接 from-replenishment API |
| Finance | events、export、summary、balances、關帳、Audit、Snapshot | 金流報表、餘額頁、關帳／稽核 | 完成（Party 升級待 Phase 2） |
| POS | createOrder、orders、export、報表（summary／top-items／daily） | POS 介面、結帳、報表、深連結 | 完成 |
| Purchase | Supplier／PO／RN、return-to-supplier、**from-replenishment** | 供應商、採購單、驗收、補貨→PO 閉環 | 完成 |
| Loyalty / Promotion / CRM | settings、ledger、dashboard、TierRule、dispatch-rules、POINTS_MULTIPLIER | 儀表板、存摺、會員、優惠券、發券規則、job 狀態 | 完成 |
| Ops | OpsJobRunLog、GET /ops/jobs/status、**GET /ops/jobs**（分頁、kind 篩選） | 發券規則頁 job 狀態區塊 | 完成 |

---

## 未開發或部分開發項目 + 前期設計問題

> 詳見 [erp-roadmap.md](../erp-roadmap.md)。以下為摘要。

### 全局審查缺口清單（依 roadmap）

> 依 `erp-roadmap.md` 與各模組 roadmap（finance-accounting / crm-member / inventory / order / purchase / product / promotion / ops）交叉盤點。以「可落地的下一步」表述；已完成者不列入缺口。

| 來源 | 缺口 | 優先 |
|------|------|------|
| erp-roadmap / Phase 4 / ops-roadmap | **報表穿透（前端一致跳轉收斂）**：將 Finance/Loyalty/POS 等頁面所有 `referenceId` 呈現與跳轉規則收斂成單一共用行為（含「不可解析」的 UX），避免每頁各做一套。 | 高 |
| erp-roadmap / Phase 4 / ops-roadmap | **報表穿透（測試與 fixture）**：補一組「可穩定穿透」的 seed/E2E fixture，並新增至少 1 則 E2E 覆蓋「點 referenceId → 導到對應單據頁」。 | 中 |
| erp-roadmap / Phase 2 / finance-accounting-roadmap | **Finance 報表視覺化（對比/趨勢）**：在金流報表補「本期 vs 上期」對比與趨勢圖（若需新 API，先補契約與整合測試）；維持不加新套件的限制。 | 中 |
| erp-roadmap / Phase 2 | **Party 多方視角正式化**：後端落地 Party（表或 view）並定義 `partyId`/kind/displayName 的唯一來源；前端以共用 Segmented 收斂「會員/供應商/其他」視角入口，且 URL query 同步一致。 | 中 |
| erp-roadmap / Phase 3 / crm-member-roadmap | **行銷工作台（CRM jobs 歷史）**：補 CRM job 歷史列表（kind/期間/分頁）與前端頁面，讓營運可查「發券/活動」歷史與結果。 | 中 |
| erp-roadmap / Phase 3 / crm-member-roadmap | **活動成效報表（Loyalty）**：擴充/落地 `GET /loyalty/reports/activity`（dispatch-rule / coupon 的發送數、使用數、點數成本、帶來營收等）並補前端成效卡；與報表穿透規則一致。 | 中 |
| order-roadmap | **換貨流程（MVP）**：以「退貨入庫 + 新單」的整合流程設計與最小 UI 落地（多步驟導引、差額處理文案、與客戶關聯預設）；不要求新增 exchange 資料表。 | 低 |
| erp-roadmap / 0.4 / Phase 3 | **會員管理路由收斂**：處理 `/admin/customers` 與 `/admin/loyalty/members`（或等價入口）重複問題，收斂為單一入口（另一個 redirect/薄殼），同步 E2E 與側欄資訊架構。 | 低 |
| ops-roadmap / Phase 4 | **Ops 手動補跑（選配）**：若產品需要，補後台「手動補跑」UI（含確認、限制文案、成功/失敗結果呈現）；後端若已提供則以串接為主。 | 低 |
| erp-roadmap / Phase 5 | **多商家（選配）**：前端商家選取器草案（先串 list/current，將 merchantId 傳遞到 2～3 頁），後端補資料隔離整合測試（POS/Finance/Loyalty 各至少 1）。 | 低 |
| erp-roadmap / Phase 5 | **RBAC（選配）**：最小角色概念骨架（非 AdminKey 的 read-only 或 role claim）＋ 1～2 個 endpoint 示範保護，並補文件與測試。 | 低 |
| erp-roadmap / 整合風險 | **CI/Preview 建庫穩定化**：針對 migration 可重放性與 P3009 類問題，補「乾淨 DB 一鍵綠」的可重現腳本/文件與 CI 檢查點（不改流程但把成功條件寫清楚）。 | 低 |
| 產品/營運常用（商品/庫存/POS） | **條碼（Barcode）支援**：商品維護條碼欄位與搜尋；盤點/結帳可用條碼快速定位商品（後端需有以 barcode 查 product 的能力；前端補最小掃碼/輸入流程）。 | 低 |
| docs/design/UI-UX-AUDIT-AND-OPTIMIZATION.md | **全站 UI/UX 統一化（不改功能）**：依審視文件：移除硬編碼色碼、統一內容寬度/字色 token、Tab/按鈕主色一致、空態/Alert/Loading 統一、補基本無障礙（skip link、focus/aria）。 | 低 |

### 後續 Phase

| Phase | 主題 |
|-------|------|
| Phase 2 | Party 多方視圖、Finance summary 正式化 |
| Phase 3 | 會員頁收斂、行銷工作台 |
| Phase 4 | Ops Job 監控頁、報表穿透 |
| Phase 5 | 多商家、角色權限（選配） |

---

## 整合風險／待對齊

- **migration 可重放性**：歷史 migrations 的「從零建庫」可重放性需持續維持；若依賴 baseline/squash，需明確規範「新環境初始化」與「舊環境升級」兩條路徑，避免 CI/Preview 認知不一致。  
- **E2E 環境一致性**：前端 E2E 需 DATABASE_URL、後端 :3003、VITE_ADMIN_API_KEY；建議 CI 或專用聯調環境定期跑完整 suite（admin-smoke、admin-bulk、admin-loyalty-smoke、admin-pos-reports、admin-replenishment、admin-balances、admin-dispatch-rules、admin-categories）。

---

本檔為**實際進度總結**，下一輪具體任務見 [tasks/instructions/](../tasks/instructions/)（開啟最新編號檔案）§1。
