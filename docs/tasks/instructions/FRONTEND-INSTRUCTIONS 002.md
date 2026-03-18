# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最下方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 必讀：前端 UI 原則與本輪任務

**本輪核心任務**：依 §1 任務執行；**視覺與互動須符合** [frontend-ui-principles.md](../frontend-ui-principles.md)，參考 [docs/mockup/](../mockup/)。

- **原則（必須遵守）**：介面以中文為主、全站無 emoji、色系語意（主內容區 #f1f5f9、側欄 #1e293b、主色 #0ea5e9、狀態綠／橙／紅）、殼層結構（側欄／頂欄／主內容區）、字階與可讀性（最小 12px、行高 ≥1.4）。
- **方向（須遵循）**：儀表板／數據感、KPI 左色條、細邊框表格、sticky 表頭、主色按鈕與 focus、區塊與懸浮列。主畫面區排版（單／雙欄、區塊順序、是否 sticky／懸浮列）可依規格與需求調整，但須符合上述原則與方向。
- **視覺與結構參考**：[docs/mockup/](../mockup/) 根目錄各頁（已套用儀表板／數據感）；樣式可對照 [mockup.css](../mockup/mockup.css)、[mockup-dashboard.css](../mockup/mockup-dashboard.css)。

---

## 常駐指令（測試資料）— 規格 Agent 勿刪

在 **Playwright E2E／手動後台／API 腳本** 中**新增寫入後端的資料**時：**該次測試跑完後（無論通過或失敗）務必刪除或還原**（spec `afterEach`、db:seed 重灌或 teardown）。勿將測試資料留在共用 DB。

---

## 0. 順序與依賴

| 項目 | 說明 |
|------|------|
| 聯調 | **VITE_API_BASE_URL** 指向後端（例如 :3003）。Loyalty 頁面接真 API 前，後端須已提供對應 API。 |
| 規格 | UI 對齊 [crm-loyalty-ui-plan.md](../crm-loyalty-ui-plan.md)（深藍側欄、卡片／表／狀態色塊）；**視覺與互動須符合** [frontend-ui-principles.md](../frontend-ui-principles.md)，參考 [docs/mockup/](../mockup/) 與 mockup.css／mockup-dashboard.css。 |

**前端 F# 與後端 B# 對照（供依賴查閱；B1～B6 已上線，F0～F6 已對接）**

| 前端 | 後端依賴 | 說明 |
|------|----------|------|
| F0 | 無 | 壳與路由 |
| F1 | B1 | 系統設定 ← GET/PATCH /loyalty/settings |
| F2 | B2 | 點數存摺 ← GET /loyalty/point-ledger |
| F3 | B3 | 會員管理 ← GET /customers（含 pointBalance／expiringSoon） |
| F4 | B4 | 儀表板 ← GET /loyalty/dashboard |
| F5 | B5（選配） | 促銷表 + usageCount；可沿用 /admin/promotions |
| F6 | B6（選配） | 優惠券頁 |

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 追加一筆。  
> 參閱 [erp-roadmap.md](../erp-roadmap.md)、[frontend-ui-principles.md](../frontend-ui-principles.md)。

### 本輪任務（依序完成，全部必做）

> 參考 [progress/integrated-last-cycle.md](../progress/integrated-last-cycle.md)「全局審查缺口清單」，**本輪聚焦於「下一階段 UX / Design System / 整合場景」，不重做上一輪已完成的報表與頁面功能**。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸維護（build + E2E）** | `pnpm --filter pos-erp-frontend build` 全綠；有環境時跑主要 E2E 並於 agent-log 註明結果（含 skipped 原因）。 |
| 2 | **Design Token 落地：色彩與字級全面替換** | 依 `frontend-ui-principles.md` 與 `UI-UX-AUDIT-AND-OPTIMIZATION.md`，整理一份 tokens（色彩、字級），將現有頁面中的硬編碼色碼與不一致字級全面替換為 token 或共用 class。 |
| 3 | **列表殼統一：StandardListLayout 元件** | 為 admin 全站列表頁（商品、庫存、金流、會員、採購、促銷、Job 等）抽出共用列表殼元件，統一外框、標題區、空態、錯誤區塊與 loading skeleton，並套用到至少 3 個核心列表頁。 |
| 4 | **浮動快速操作列標準化** | 為「批次操作／快速操作」情境（補貨建議、批量匯入匯出、POS 加車等）設計一套統一的浮動操作列樣式與行為，並落地到至少 2 個現有頁面。 |
| 5 | **條碼（Barcode）UX：庫存與 POS** | 在庫存盤點與 POS 加品項場景中，補「輸入/掃描條碼 → 定位商品」的最小流程，串接後端的 barcode 查詢 API（若尚未提供則先以 mock/stub 實作並標註）。 |
| 6 | **多商家 Phase 2：商家選取器與 URL 傳遞** | 依 erp-roadmap Phase 5，完善 AdminLayout 頂欄商家選取器：從後端 read list/current，並將 merchantId 以 URL 或 context 傳遞到 2～3 個核心頁，確保切換商家時體驗合理。 |
| 7 | **活動成效報表 v2：視覺與互動升級** | 在既有 Loyalty 活動成效頁基礎上，依後端 v2 指標補強卡片、表格與圖表（例如 ROI、平均用券次數），並優化篩選與空態。 |
| 8 | **換貨整合場景：從報表到 POS** | 設計並實作一條整合 user journey：從某個報表（例如 POS 報表或活動報表）點擊進入訂單，再由訂單詳情觸發換貨流程；確保 URL、breadcrumb 與回退行為合理。 |
| 9 | **整合 E2E：報表 → 換貨 → 活動成效** | 新增 1 支整合型 E2E：從報表頁點擊 referenceId 進訂單 → 走換貨流程 → 回到活動成效或報表頁檢查指標變化；若需 ADMIN_API_KEY / DB，依慣例加 skip 條件。 |

---

## 2. 驗收

- [ ] §1 十項依序完成（遇卡點於 agent-log 註明）；後端 API 未就緒時可先 stub 或註明待後端
- [ ] **迴歸驗收**：`pnpm --filter pos-erp-frontend build` 全綠；有環境時跑 E2E（admin-smoke、admin-bulk、admin-loyalty-smoke、admin-pos-reports、admin-replenishment、admin-balances、admin-dispatch-rules、admin-categories），並於 agent-log 註明結果
- [ ] agent-log 追加一筆（含 HH:MM）

---

## 3. 禁止

- 不實作 UI、僅改 docs 即視為本輪完成。
- 拆掉採購側欄三連結。
- 在後端對應 API 未完成時，於 UI 假裝已寫入或回傳成功。
- **UI 與 frontend-ui-principles.md 衝突**（整頁英文、emoji、主色／殼層不符等）。
- **刪減現有規格或功能**（路由、API、表單、篩選、匯出、E2E 可測行為須維持）。

---

## 4. 固定參考

| 用途 | 路徑 |
|------|------|
| **全站 Roadmap（必讀）** | [erp-roadmap.md](../erp-roadmap.md) |
| **UI 原則（必讀）** | [frontend-ui-principles.md](../frontend-ui-principles.md) |
| **視覺與結構參考** | [docs/mockup/](../mockup/)（根目錄各頁）、[mockup.css](../mockup/mockup.css)、[mockup-dashboard.css](../mockup/mockup-dashboard.css) |
| 後端步驟與 B# | [tasks/instructions/](../tasks/instructions/) |
| 金流／財務報表 | [finance-accounting-roadmap.md](../finance-accounting-roadmap.md) |
| UI 範本 | [crm-loyalty-ui-plan.md](../crm-loyalty-ui-plan.md) |
| Seed | [db-seed.md](../db-seed.md) |
| 守則與協作 | [AGENT-RULES.md](../AGENT-RULES.md)、[agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md) |
| E2E | [e2e-pos.md](../e2e-pos.md) |

