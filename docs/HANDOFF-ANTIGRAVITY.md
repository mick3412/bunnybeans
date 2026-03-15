# 專案交接：打包給 Google Antigravity 獨立開發

本文件說明如何將 **POS/ERP 專案** 打包交給 **Antigravity** 團隊，作為**額外支線、可獨立開發**的程式庫。主線可暫停下一輪計畫；Antigravity 在支線開發，不必然 merge 回主線。

---

## 一、交接前你這邊要做的事

### 1. 決定交接基準（分支／tag）

任選一種：

| 方式 | 作法 | 適用情境 |
|------|------|----------|
| **新分支** | 從目前 **main**（或你正在開發的 branch）建立 **`handoff/antigravity`**，所有未 commit 的變更先 commit 到該分支。 | 希望他們有清楚起點、之後可再給更新 |
| **Tag** | 打一個 tag，例如 **`handoff-antigravity-2026-03`**。 | 只要給一個固定快照、不打算再同步 |
| **現狀** | 直接以目前工作目錄為準，不另建分支。 | 最簡單，但對方拿到的就是「當下磁碟狀態」 |

建議：**建立分支 `handoff/antigravity` 並 push 到遠端**，再依下面方式打包或提供 clone 網址。

```bash
# 在你本機 POS 專案根目錄
git checkout -b handoff/antigravity
git add -A && git status   # 確認要交的檔案
git commit -m "chore: handoff baseline for Antigravity"
git push origin handoff/antigravity
```

### 2. 打包方式（三選一）

#### 選項 A：提供 Git clone（推薦）

對方有 repo 權限時，直接給：

```text
git clone --branch handoff/antigravity <你的 repo URL> pos-antigravity
cd pos-antigravity
```

他們就得到完整歷史 + 該支線，可獨立開自己的 branch 開發。

#### 選項 B：Git bundle（離線／單檔）

適合不能直接給雲端 repo 時：產生一個單一檔案，對方用 `git clone` 從該檔還原。

```bash
# 在你本機
git bundle create pos-handoff-antigravity.bundle handoff/antigravity
# 把 pos-handoff-antigravity.bundle 交給對方（傳檔／雲端連結）
```

對方：

```bash
git clone pos-handoff-antigravity.bundle pos-antigravity -b handoff/antigravity
cd pos-antigravity
```

#### 選項 C：Zip 壓縮（無 Git 歷史）

不給歷史、只要「當下程式碼」時：

```bash
# 在專案上一層目錄執行，排除不需交接的內容
cd /Users/micklu
zip -r POS-handoff-antigravity.zip POS \
  -x "POS/node_modules/*" \
  -x "POS/backend/node_modules/*" \
  -x "POS/frontend/node_modules/*" \
  -x "POS/.env" \
  -x "POS/.git/*" \
  -x "POS/*.bundle"
```

請勿把 **`.env`**、**`node_modules`** 打包進去；對方需自建環境（見下）。

---

## 二、交給對方的檔案／目錄建議

無論用 A/B/C，對方都應至少拿到：

- 根目錄 **package.json**、**pnpm-workspace.yaml**（若有）
- **backend/**（含 **prisma/**、**src/**、**package.json**）
- **frontend/**（含 **src/**、**vite.config**、**package.json**）
- **docs/**（整夾，含本檔、db-seed、api-design-*、agent-collab、tasks 等）
- **scripts/**（如 **restart-dev.sh**、**e2e-*.sh**）
- **e2e/**（Playwright 測試）
- 根目錄 **.env.example**（勿交 **.env**，請對方自複製並填值）

若用 Zip，可一併給 **.cursor/**、**.cursorignore**、**.prettierrc** 等，方便他們沿用設定。

---

## 三、Antigravity 端：環境與啟動（給對方看的說明）

可把以下區塊直接複給 Antigravity 團隊。

### 1. 環境需求

- **Node.js** 18+（建議 20）
- **pnpm**（`npm install -g pnpm`）
- **PostgreSQL**（本機或遠端，專案用 Prisma）

### 2. 環境變數

複製 **.env.example** 為 **.env**，並依實際 DB 調整：

```bash
cp .env.example .env
# 編輯 .env：若用單一連線字串可設
# DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
# 或保留 DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME（後端需能組出 DATABASE_URL）
```

後端通常會讀 **DATABASE_URL** 或 **DB_***；前端開發時會用 **VITE_API_BASE_URL**（例如 `http://localhost:3003`），未設時 dev 會預設連 127.0.0.1:3003。

**Admin 後台 API** 需 **X-Admin-Key**，與後端 **ADMIN_API_KEY** 一致；E2E 可設 **VITE_ADMIN_API_KEY**。

### 3. 安裝與 DB 初始化

```bash
pnpm install
pnpm --filter pos-erp-backend exec prisma migrate deploy
pnpm db:seed
```

**注意**：**db:seed** 會清空業務表並寫入 DEMO 劇本（見 **docs/db-seed.md**），僅限本機／測試環境。

### 4. 啟動開發

```bash
# 後端 :3003 + 前端 :5173
pnpm dev
# 或使用
pnpm dev:app
```

後台：**http://localhost:5173**（或前端 dev 顯示的埠）；API：**http://localhost:3003**。

### 5. 測試

```bash
pnpm test          # 後端 jest + 前端（若有）
pnpm e2e           # Playwright（需後端已起、可設 VITE_ADMIN_API_KEY）
```

---

## 四、建議 Antigravity 必讀文件（docs/）

| 文件 | 說明 |
|------|------|
| **db-seed.md** | Seed 劇本、會員↔訂單↔點數對照、執行前須 migrate |
| **api-design-loyalty.md** | Loyalty API 契約（dashboard、point-ledger、settings） |
| **api-design-purchase.md** | 採購／驗收 API |
| **crm-loyalty-ui-plan.md** | Loyalty CRM UI 範本與階段 |
| **e2e-pos.md** | E2E 測試清單與 skip 條件 |
| **AGENT-RULES.md** | 本專案開發守則與 API 路徑（可選） |
| **progress/integrated-last-cycle.md** | 上一輪整合摘要與「暫停下一輪」說明 |
| **HANDOFF-ANTIGRAVITY.md** | 本交接說明 |

若他們要延續「規格→後端→前端」循環，可再給 **docs/agent-collab/** 與 **docs/tasks/**（BACKEND-INSTRUCTIONS、FRONTEND-INSTRUCTIONS）。

---

## 五、約定：支線、可獨立

- 此交接為**額外支線**，Antigravity 在 **handoff/antigravity**（或自己 fork 的 branch）上開發即可，**不強制 merge 回主線**。
- 主線目前**暫停下一輪計畫**（見 **progress/integrated-last-cycle.md**）；若之後要再同步，可再約定（例如再給一次 bundle 或 cherry-pick 範圍）。
- 機密與帳密：**勿將 `.env` 或真實 DB 連線放進 repo**；對方自建 **.env** 並自行管理。

---

## 六、快速檢查清單（你交接前）

- [ ] 已建立 **handoff/antigravity**（或 tag）並 push／打包
- [ ] 未把 **.env**、**node_modules** 打包進去
- [ ] **.env.example** 已包含必要變數說明（或在本檔寫清）
- [ ] **docs/HANDOFF-ANTIGRAVITY.md** 已一併交給對方（或放在他們拿得到的 repo 路徑）
- [ ] 已告知對方「支線、可獨立」及必讀 docs 清單
