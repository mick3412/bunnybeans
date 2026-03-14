## ERP 專案開發前置作業 Checklist

此文件列出在正式開始開發前，建議先確認與準備的項目。  
你可以依照實際情況在每項目前加上狀態標註（例如：`[ ]` 未做、`[x]` 已完成）。

**Agent／協作現行入口（路徑已對齊 repo）**：

- [agent-collab/AGENT-COLLABORATION.md](agent-collab/AGENT-COLLABORATION.md) — 流程與整夾說明  
- [tasks/BACKEND-INSTRUCTIONS.md](tasks/BACKEND-INSTRUCTIONS.md) · [FRONTEND-INSTRUCTIONS.md](tasks/FRONTEND-INSTRUCTIONS.md) — 每輪任務  
- [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md) — 整合摘要  
- [README.md](README.md)（本 `docs/` 總索引）— 全索引  

---

### 一、技術堆疊與專案骨架

- [ ] **後端技術堆疊已決定**
  - 範例：Node.js + TypeScript / Java + Spring / .NET 等
  - 已考量團隊熟悉度、部署環境、長期維護性

- [ ] **資料庫選型已決定**
  - 建議 PostgreSQL / MySQL 等支援交易與 Trigger 的 RDB
  - 已確認之後可支援事件表 + 匯總表設計

- [ ] **前端技術堆疊已決定**
  - 後台管理端 Web 框架（React / Vue / 其他）
  - POS 介面是否與後台共用技術（建議共用，以降低心智負擔）

- [ ] **專案目錄與模組骨架草圖完成**
  - 已初步規劃領域模組：`Merchant / Supplier / Product / Inventory / Customer / POS / Purchase / CRM / Finance`
  - 先建立空目錄或簡單 README，讓架構一目了然

---

### 二、資料與識別規則

- [ ] **單號 / ID 規則已定義**
  - 銷售單、退貨單、進貨單、退供單、盤點單、調撥單、關帳批次等
  - 格式（是否含日期、流水號長度、前綴）、是否跨通路統一或分通路

- [ ] **多通路 / 多倉庫模型已釐清**
  - 門市倉、官網倉、IG / 預購倉等的關係
  - 哪些倉庫對應實體門市、哪些為虛擬倉

- [ ] **時間與時區策略已決定**
  - 資料庫一律以 UTC 儲存時間
  - 介面依據門市 / 使用者設定顯示當地時區
  - 重要時間欄位：建立時間、交易時間、關帳時間等已列入規格

---

### 三、環境與設定管理

- [ ] **環境切分策略已定義**
  - 至少：`local`（開發）、`staging`（準正式）、`prod`（正式）
  - 已決定哪些功能僅在 staging / prod 開啟（如實際金流）

- [ ] **設定與密鑰管理方式已決定**
  - 使用 `.env` / 設定檔 + 不進 Git 原則
  - 規劃 Cyberbiz、金流、Line、IG 等 API key 的存放方式與輪替機制

- [ ] **部署與備援方向有初步想法**
  - Local Host 主機規格預估
  - 是否需要資料庫 replica / 備援主機

---

### 四、Git 與協作流程

- [ ] **Git 分支策略已決定**
  - 範例：`main`（穩定）、`develop`（整合）、`feature/*`（需求）

- [ ] **Commit 與 PR 規範已粗訂**
  - Commit 命名慣例（例如 `feat/inventory: ...`、`fix/finance: ...`）
  - PR 模板（變更內容、風險、回滾方式、測試方式）

- [ ] **Issue / 任務管理工具已選擇**
  - 例如 Notion / GitHub Issues / Jira 等
  - 規範如何連結需求、設計與實作（例如：Issue 連結 PR）

---

### 五、測試策略與測試資料

- [ ] **測試策略與優先級已確認**
  - 第一批一定要有測試的模組（建議：`Inventory`、`Finance`、`POS 結帳流程`）
  - 單元測試 / 整合測試 / 端對端測試的最低標準

- [ ] **標準測試情境列表已整理**
  - 至少包含：
    - 1 家商戶、多通路（門市 + 官網）
    - 多個倉庫（含實體與虛擬）
    - 幾組有 / 無效期商品、組合商品
    - 幾個會員（不同等級、不同行為模式）

- [ ] **測試資料 seed 腳本規劃**
  - 未必要一開始就寫完，但已規劃未來如何一鍵建立測試資料
  - 已實作：`backend/prisma/seed.ts`，執行方式見 `docs/db-seed.md`（`pnpm --filter pos-erp-backend db:seed`）

---

### 六、監控、Log 與 Audit

- [ ] **Log 策略已定義**
  - 最低欄位：`traceId`、`userId`、`module`、`useCase`、`request 摘要`、`errorCode`
  - 檔案或集中式 Log（未來可接其他服務）

- [ ] **Audit Log 範圍已列出**
  - 例如：
    - 人工調整庫存
    - 人工調整應收 / 應付或折讓
    - 解鎖 / 關帳操作
    - 修改敏感設定（稅率、點數規則等）

- [ ] **與 `inventory-finance-immutability.md` 對齊**
  - 已檢查 Audit Log 設計與「事件 + 匯總」模型一致

---

### 七、對外整合前置調查

- [ ] **Cyberbiz 功能與 API 範圍已初步盤點**
  - 決定誰是「主系統」（以哪邊庫存 / 訂單為準）
  - 整理同步方向（單向 / 雙向）、大致資料流

- [ ] **支付 / Line / IG 等整合需求已整理**
  - 各服務需要的 callback URL、授權流程
  - 是否提供 sandbox / 測試環境

---

### 八、文件與知識管理

- [ ] **主要文件索引已建立**
  - `erp-spec.md`：功能與流程規格
  - `DEVELOPMENT-GUIDELINES.md`：開發守則
  - `docs/inventory-finance-immutability.md`：庫存與金流不可變與備援設計
  - `docs/pre-development-checklist.md`：目前這份前置作業 Checklist
  - `docs/README.md`：docs 總索引（含 Agent 流程與歸檔路徑）

- [ ] **Notion 使用規則已簡單約定**
  - 每日進度（三欄）：今日完成 / 卡點 / To Do
  - 需求與設計決策紀錄（重要變更需在此留下摘要與連結）

---

### 九、第一階段開發範圍（建議）

- [ ] **Phase 1 模組範圍已確認**
  - 例如：`商品 / 庫存 + POS 銷售 + 基礎會員 + 基礎報表`

- [ ] **Phase 2 之後的模組先列出**
  - 例如：進階 CRM、行銷活動、財務應收 / 應付整合、外部系統同步等

---

可以依照實際情況增刪項目；當某一區塊完成時，也可以在對應區域加上日期或備註，當成專案「啟動紀錄」。

