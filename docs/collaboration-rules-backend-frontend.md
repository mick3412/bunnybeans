## Backend / Frontend 協作規則（Agent 版本）

> 目的：讓「後端 Agent」與「前端 Agent」在此專案中有一致的工作方式，避免互相猜測實作。  
> 適用範圍：POS ERP 專案的所有 API / 型別 / 模組設計與實作。

---

### 1. 真相來源與閱讀順序

所有 Agent 在開始工作前，必須先依下列順序閱讀：

1. `DEVELOPMENT-GUIDELINES.md`
   - 瞭解四層分層（Domain / Application / Interface / Infrastructure）、模組邊界、防火牆，以及「事件 + 匯總」原則。
2. `docs/inventory-finance-immutability.md`
   - 瞭解 `InventoryEvent` / `FinanceEvent` 的不可變設計與匯總表的角色。
3. `erp-spec.md`
   - 瞭解整體 ERP 流程與業務名詞。
4. `docs/backend-module-design.md`
   - 瞭解目前 backend 模組結構、Service / Repository 介面與跨模組關係。
5. `docs/api-design-pos.md`、`docs/api-design-inventory-finance.md`
   - 瞭解 POS / Inventory / Finance API 的 HTTP 合約與狀態（draft / stable）。
6. `shared/src/index.ts`
   - 確認跨專案共用的 TypeScript 型別（特別是 `InventoryEvent`, `FinanceEvent`）。

> 規則：**文件與 shared 型別是唯一真相來源，程式碼不得作為 API 合約的唯一依據。**

---

### 2. Endpoint 狀態標註（draft / planned / stable）

在 `docs/api-design-*.md` 中，每個 endpoint 必須標註狀態：

- `draft`：草稿，可能變動；前端可用來思考畫面，但不得視為正式合約。
- `計畫中` / `planned`：本輪預計會實作，欄位已大致確定。
- `stable`：已實作並可依賴；前端可以安全整合。

約定：

- **前端 Agent** 不得對 `draft` 狀態做強依賴（例如直接在 UI 綁死所有欄位），只能用來構思。
- **後端 Agent** 若要修改 `stable` endpoint，必須先在文件中提出變更，經 Owner 同意後，採「新增欄位 / 新版 API」優先，避免破壞相容性。

---

### 3. 角色與責任

#### 3.1 後端 Agent

- **負責**
  - 設計與維護 Prisma schema：`backend/prisma/schema.prisma`。
  - 實作與維護後端模組、Service / Repository 與 Controller：依 `docs/backend-module-design.md`。
  - 實作與維護 API：依 `docs/api-design-pos.md`、`docs/api-design-inventory-finance.md`。
  - 維護必要的 seed 腳本與後端測試。
- **變更流程**
  1. 任何新功能或變更，**先更新文件**：
     - 在 `docs/api-design-*.md` 補上或修改 endpoint 合約（含 Request/Response 範例與狀態標註）。
     - 在 `docs/backend-module-design.md` 更新或新增 Service / Repository 介面。
  2. 經 Owner 確認文件後，才開始修改 NestJS / Prisma 程式碼。
  3. 若需新增或修改共用型別：
     - 先在文件中以 TS 介面草稿描述。
     - 確認穩定後，最後才更新 `shared/src/index.ts`，並在回覆中說明「新增/變更了哪些型別」。

#### 3.2 前端 Agent

- **負責**
  - 依 `docs/api-design-*.md` 與 `shared/src/index.ts` 開發 **POS UI** 與 **Admin 後台**（庫存／商品等，見 [docs/admin-inventory-ui.md](admin-inventory-ui.md)）。
  - 在 API 尚未實作時，以 mock API（結構需與文件一致）先完成畫面與資料流。
- **約束**
  - **POS**：不直接呼叫 `/inventory/*`、`/finance/*`（扣庫由建單內部完成）。
  - **Admin**：可呼叫 stable 的 `/inventory/*`（查詢與手動事件）、`/products` CRUD、`/warehouses` 等，仍以文件為準。
  - 不得直接以「閱讀後端程式碼」推論 API 結構後就實作，必須以文件與 shared 型別為準。
  - 若需新增欄位或改動結構：
    - 不直接改 UI 然後假設後端會接受，而是透過 Owner 提出需求。
    - 由後端 Agent 更新文件與 shared 型別後，再更新前端。

---

### 4. 新需求的標準流程

以「打通 POS 單品結帳 → 庫存扣減 → 金流事件」為例，一輪流程如下：

1. **Owner 定義目標**
   - 在任務描述中寫明本輪目標與範圍，並指名相關文件（例如：POS + Inventory + Finance）。

2. **後端 Agent：只改文件，不改程式**
   - 更新：
     - `docs/api-design-pos.md`：`POST /pos/orders` 等 endpoint 的 Request/Response、錯誤碼、狀態。
     - `docs/api-design-inventory-finance.md`：如會新增/更動 Inventory / Finance API。
     - `docs/backend-module-design.md`：若 Service / Repository 介面須更新。
   - 若需要新 DTO / 型別，先在文件中以 TS 介面展示，標註「暫存在文件」。

3. **Owner 審閱文件**
   - 若需修改，回到步驟 2 迭代；同意後，才允許進入實作階段。

4. **前端 Agent：依文件與 shared 型別開發**
   - 依 `docs/api-design-*.md` / `shared/src/index.ts` 定義前端型別與呼叫邏輯。
   - 用 mock API（完全遵守文件格式）先完成畫面與流程。

5. **後端 Agent：實作與驗證**
   - 依文件實作 Service / Repository / Controller。
   - 新增或更新必要的 seed 與後端測試，確保行為與文件一致。
   - 實作完成後：
     - 將對應 endpoint 狀態從 `計畫中` 改為 `stable`。
     - 提供簡單測試說明（curl / Postman / e2e 測試連結）。

6. **整合與回饋**
   - 前端切換到真實 API。
   - 若發現文件與行為不一致，**以文件為準**：由實作方（多半是後端）先對齊文件；若需求確實改變，再由文件方（多半是 Owner + 後端）更新規格，之後再調整前端。

---

### 5. 共用型別（shared）變更守則

- **新增**
  - 條件：該型別會被 backend 與 frontend 共同使用。
  - 步驟：
    1. 在 `docs/api-design-*.md` 或 `docs/backend-module-design.md` 中先以 TS 介面描述用途與欄位。
    2. Owner 同意後，將該介面正式加入 `shared/src/index.ts`。
    3. 前後端改用此共用型別。

- **修改**
  - 原則：優先維持向下相容，不直接破壞既有欄位。
  - 步驟：
    1. 在文件中提出變更提案（例如新增欄位、欄位改名），說明對前端/後端影響。
    2. Owner 排程，在新版本中實施。
    3. 實作時先同時支援新舊欄位（必要時），待前後端全部更新後才考慮移除舊欄位。

---

### 6. 錯誤格式與 logging 原則

- **錯誤格式**
  - 後端已提供統一錯誤結構，說明見 `docs/backend-error-format.md`。回應至少包含：
    - `statusCode`、`message`、`error`、`traceId`（若有）。
  - 前端可依賴 `statusCode` 與 `message` 顯示錯誤；若有 `traceId` 可一併顯示或傳給後端除錯。

- **logging 與 trace**
  - 後端會在 log 中包含 `traceId` / `module` / `useCase` 等欄位。
  - 若 API 回傳 `traceId`，前端應在錯誤顯示或除錯工具中保留，方便對應後端 log。

---

### 7. 衝突處理

- 若出現以下情況：
  - 文件與實際 API 行為不一致。
  - shared 型別與文件定義不一致。
  - 前、後端對欄位意義有不同理解。
- 處理順序：
  1. 以 `DEVELOPMENT-GUIDELINES.md` 與 `docs/inventory-finance-immutability.md` 為最高準則。
  2. 以 `docs/api-design-*.md` 與 `docs/backend-module-design.md` 為 API / Service 真相。
  3. 由 Owner 決定是：
     - 修正實作以對齊文件，或
     - 正式修改文件，再讓前、後端一起調整。

> 總結：**任何時候都不要靠「猜測對方程式碼」來協作；所有溝通都以文件與 shared 型別為中心。**

---

### 8. 給人類 Owner 的使用方法

以下是你在指派任務給不同 Agent 時，可以直接複製貼上的範本。

#### 8.1 指派「後端 Agent」任務的範本

> 你是後端 Agent。  
> 在開始前，請依序重讀：  
> - `DEVELOPMENT-GUIDELINES.md`  
> - `docs/inventory-finance-immutability.md`  
> - `docs/backend-module-design.md`  
> - 相關的 `docs/api-design-*.md`  
> - `shared/src/index.ts`  
> 並遵守 `docs/collaboration-rules-backend-frontend.md`，**只依照這些文件與 shared 型別行事，不要猜測前端或直接改 API 合約。**  
> 接著，請幫我完成以下後端任務：  
> （在這裡描述本輪具體目標，例如實作哪些 endpoint／Service）

#### 8.2 指派「前端 Agent」任務的範本

> 你是前端 Agent。  
> 在開始前，請先閱讀：  
> - `docs/collaboration-rules-backend-frontend.md`  
> - 相關的 `docs/api-design-*.md`  
> - `shared/src/index.ts`  
> 所有 API Request/Response 結構一律以這些文件與 shared 型別為準，**不要從後端程式碼反推介面，也不要自行假設後端欄位。**  
> API 若尚未實作，請依文件中的 JSON 範例自行建立 mock API 先完成 UI 與資料流。  
> 接著，請幫我完成以下前端任務：  
> （在這裡描述需要的畫面或流程）

#### 8.3 每一輪任務開始前的快速檢查清單

在你自己啟動一輪新任務前，可以先檢查：

- [ ] 這一輪的目標與範圍已在任務描述中寫清楚（例如：POS 結帳 / 庫存查詢 / 報表）。
- [ ] 已在任務描述中要求該 Agent 重讀 `docs/collaboration-rules-backend-frontend.md` 與相關 `docs/api-design-*.md`。
- [ ] 若會改 API 或 shared 型別，已明確標註「先改文件，後實作」。
- [ ] 若任務會影響另一個 Agent（例如後端改 API、前端需配合），有在描述中提醒你自己之後要開一個對應任務給另一邊。

---

### 9. 進度紀錄（現行：agent-collab + integrated-last-cycle）

- **現行寫入**：後端 **[docs/agent-collab/agent-log-backend.md](agent-collab/agent-log-backend.md)**、前端 **[agent-log-frontend.md](agent-collab/agent-log-frontend.md)**（僅追加）；規格收尾覆寫 **[docs/progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)**。流程見 **[docs/agent-collab/AGENT-COLLABORATION.md](agent-collab/AGENT-COLLABORATION.md)** 與 **[docs/progress/README.md](progress/README.md)**。
- **歷史**：`docs/progress/backend/`、`frontend/`、根目錄 `integrated-progress-*` 之日檔已歸檔至 **[docs/progress/archive/2026-03/](progress/archive/2026-03/)**。
- **同一天保留 log**：agent-log 與舊日檔均遵守「本日變更僅追加」；格式見 `docs/daily-progress-format.md`。

