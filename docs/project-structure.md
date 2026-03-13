## ERP Monorepo 技術堆疊與目錄規劃

本文件描述本 ERP 專案採用的技術堆疊與單一 repo（monorepo）目錄結構，作為之後實際建立骨架與開發的依據。

---

## 1. 技術堆疊（全部採免費 / 開源）

- **後端**: Node.js + TypeScript + NestJS  
- **前端**: React + TypeScript + Vite  
- **資料庫**: PostgreSQL（支援交易、Trigger，適合事件 + 匯總模型）  
- **套件管理**: pnpm（或 yarn workspace）  
- **測試 / 品質**: Jest 或 Vitest、ESLint、Prettier  
- **架構型態**: 單一 repo（monorepo），前後端與 shared 放在同一專案

---

## 2. Monorepo 頂層目錄結構

```text
/
├─ backend/        # 後端 API（Node + TS + NestJS）
├─ frontend/       # 前端（React + TS + Vite）
├─ shared/         # 前後端共用型別與工具
├─ docs/           # 規格與設計文件
├─ scripts/        # 之後的 DB / seed / backup 腳本
├─ package.json    # root，工作區與共用 script
├─ pnpm-workspace.yaml  # 或 yarn workspaces 設定
├─ tsconfig.base.json
├─ .editorconfig
├─ .eslintrc.*
├─ .prettierrc.*
├─ .gitignore
└─ .env.example
```

---

## 3. Backend 結構（`/backend`）

### 3.1 目錄

```text
backend/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ main.ts              # 入口
   ├─ app.module.ts        # Nest root module
   ├─ config/              # 設定與環境變數載入
   ├─ domain/              # 領域模型與服務
   │  ├─ merchant/
   │  ├─ supplier/
   │  ├─ product/
   │  ├─ inventory/
   │  ├─ customer/
   │  ├─ pos/
   │  ├─ purchase/
   │  ├─ crm/
   │  └─ finance/
   ├─ application/         # Use Cases / Application services
   │  └─ (對應各領域模組)
   ├─ interface/           # API / Controllers / DTO
   │  └─ http/
   └─ infrastructure/      # DB / 第三方服務實作
      ├─ persistence/
      └─ external/
```

### 3.2 主要 npm 套件（免費）

- 核心: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`
- TypeScript: `typescript`, `ts-node`（dev）
- 驗證: `class-validator`, `class-transformer`
- ORM + DB（擇一）:
  - TypeORM: `typeorm`, `pg`
  - 或 Prisma: `prisma`, `@prisma/client`, `pg`
- 設定: `@nestjs/config` 或 `dotenv`
- 測試: `jest`, `ts-jest`, `@types/jest`（或 `vitest`）
- Lint / Format: `eslint`, `@typescript-eslint/*`, `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier`

---

## 4. Frontend 結構（`/frontend`）

### 4.1 目錄（React + Vite + TS）

```text
frontend/
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ index.html
└─ src/
   ├─ main.tsx
   ├─ app/
   │  ├─ router.tsx        # 路由設定
   │  └─ providers.tsx     # 全域 Provider，例如 React Query
   ├─ modules/             # 依領域切模組
   │  ├─ merchant/
   │  ├─ supplier/
   │  ├─ product/
   │  ├─ inventory/
   │  ├─ customer/
   │  ├─ pos/
   │  ├─ purchase/
   │  ├─ crm/
   │  └─ finance/
   ├─ components/          # 共用 UI 元件
   ├─ pages/               # 畫面入口（可選）
   ├─ api/                 # 對 backend API 的呼叫封裝
   ├─ utils/
   └─ styles/
```

### 4.2 主要 npm 套件（免費）

- 核心: `react`, `react-dom`
- 開發: `vite`, `@vitejs/plugin-react-swc`, `typescript`
- 路由: `react-router-dom`
- 資料 fetching / 狀態（建議）: `@tanstack/react-query`
- UI Library（擇一）: `@mui/material` / `antd` / `chakra-ui` 等
- 測試（選配）: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`
- Lint / Format: `eslint`, `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier`

---

## 5. Shared 結構（`/shared`）

### 5.1 目錄

```text
shared/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ types/        # DTO、共用型別（例如 API Request/Response）
   ├─ constants/    # 錯誤碼、事件枚舉、通用常數
   └─ utils/        # 純函式工具（不依賴 Node/DOM）
```

### 5.2 套件

- `typescript`
- 盡量避免額外依賴，保持純淨，方便前後端共用。

---

## 6. docs 與 scripts（補充）

- `docs/erp-spec.md`：ERP 功能與流程規格
- `docs/DEVELOPMENT-GUIDELINES.md`：開發守則
- `docs/inventory-finance-immutability.md`：庫存 & 金流不可變與雙重備援設計
- `docs/pre-development-checklist.md`：前置作業 checklist
- `docs/project-structure.md`：本文件
- 未來可新增：
  - `docs/api-design-principles.md`（API 命名與錯誤格式約定）

`scripts/`（稍後再補實作）可放：

- `db/init-postgres.sql` 或 `db/init.sh`
- `db/seed-demo-data.ts`
- `backup/backup-postgres.sh`

---

## 7. Root workspace 設定（概念）

- `package.json`（root）
  - `private: true`
  - `workspaces` 指向 `backend`, `frontend`, `shared`
  - scripts：
    - `"dev"`：同時啟動 backend + frontend
    - `"build"`：依序 build shared → backend → frontend
    - `"lint"` / `"test"`：聚合子專案指令

- `pnpm-workspace.yaml`
  - `packages: ["backend", "frontend", "shared"]`

此結構作為後續實際建立專案骨架時的參考，不含任何業務程式碼，只規劃目錄與免費工具選擇。

