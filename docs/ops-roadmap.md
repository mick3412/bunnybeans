# 作業監控 — 整合型規格與開發計畫

本文件為**Ops Job 執行紀錄與監控**的單一總覽：先給出目標、設計原則、API 總覽與階段規劃，最後對照現況。

> 上一輪整合見 [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)。部署與 job 說明見 [deploy-preview.md](deploy-preview.md)。

---

## 一、目標與範圍

### 1.1 目標

- **Job 執行可追蹤**：定時 job（發券、關帳、快照等）執行結果寫入 OpsJobRunLog。
- **狀態查詢**：各 job 類型最近一次執行時間、成功與否、錯誤摘要。
- **列表查詢**：支援分頁、kind 篩選，供後台監控與排查。

### 1.2 範圍

| 範圍 | 說明 |
|------|------|
| **OpsJobRunLog** | jobType、lastRunAt、success、message |
| **GET /ops/jobs/status** | 各定時 job 最近一次狀態 |
| **GET /ops/jobs** | 歷史紀錄列表（分頁、kind 篩選） |
| **關聯** | crm-run-scheduled、finance-period-close、finance-snapshot |

---

## 二、設計原則

- **以查詢為主**：Ops 模組以狀態/列表查詢為主；但為了補跑與排查，提供**受限的手動補跑** API（`POST /ops/jobs/run`，需 `X-Admin-Key`，且僅支援部分 jobType）。
- **append-only**：每次執行寫入一筆 OpsJobRunLog，不覆寫。
- **與 CRM / Finance 解耦**：job 執行邏輯在各模組，Ops 僅紀錄。

---

## 三、API 總覽

| Method | Path | 說明 | 狀態 |
|--------|------|------|------|
| GET | /ops/jobs/status | 各 jobType 最近一次執行狀態 | **stable** |
| GET | /ops/jobs | 歷史紀錄列表（page、pageSize、kind、from、to；回傳 messageSummary） | **stable** |
| POST | /ops/jobs/run | 手動補跑指定 job（Admin；會寫 OpsJobRunLog） | **stable** |
| GET | /ops/references/resolve | 報表穿透：解析 referenceId 對應單據（POS 訂單 / 驗收單 / unknown） | **stable** |
| POST | /ops/reports/click-audit | 報表穿透 2.0：點擊審計（記錄 referenceId 解析結果與成功率） | **stable** |
| GET | /ops/reports/click-audit | 點擊審計列表（分頁、排序、交叉篩選，含 resultCode filter） | **stable** |
| GET | /ops/reports/click-audit/summary | 點擊審計彙總（含 topSources/trendByDay/topReferenceIds） | **stable** |

**jobType 範例**：`crm-run-scheduled`、`finance-period-close`、`finance-snapshot`

### 3.1 報表穿透：referenceId 解析 `GET /ops/references/resolve`（stable）

- **用途**：前端報表點擊 `referenceId` 時，判斷應穿透到哪一張單據（目前支援 POS 訂單、採購驗收單）。
- **Query**
  - `referenceId`（必填；字串）
- **Response** `200`
  - `{ referenceId: string, kind: "posOrder" | "receivingNote" | "unknown" }`
- **unknown 規則**
  - `referenceId` 為空字串 → `kind=unknown`
  - `referenceId` 非 UUID → `kind=unknown`（不丟 400，方便前端統一處理）
  - `referenceId` 為 UUID 但資料不存在 → `kind=unknown`
- **備註（目前辨識順序）**：若同時符合（理論上不會），優先視為 `posOrder`，其次 `receivingNote`。

### 3.1a 報表穿透 2.0：點擊審計 `POST /ops/reports/click-audit`（stable）

- **用途**：前端在報表中點擊 `referenceId` 穿透時，回報一次審計紀錄，供日後分析「哪些穿透最常用／最常失敗」。審計只記錄行為與解析結果，不影響穿透流程。
- **保護**：需 `X-Admin-Key`
- **Body**
  - `source`（必填）：來源報表或頁面（例如 `finance-events`、`loyalty-ledger`、`pos-reports`）
  - `field?`（選填，預設 `referenceId`）：來源欄位名稱
  - `referenceId`（必填）：被點擊的 referenceId（字串；可能不是 UUID）
  - `merchantId?`（選填）：商家 UUID（若前端可得）
  - `resultCode?`（選填）：點擊結果分類（供 UX/可觀測性）。建議值：
    - `NOT_FOUND`：無法解析/找不到單據
    - `MULTI_MATCH`：多筆命中（例如條碼多筆、或未來擴充情境）
    - `PERMISSION`：權限不足/無法導覽
    - `NAVIGATED`：成功導覽到單據頁
- **行為**
  - 內部會用與 `GET /ops/references/resolve` 相同的邏輯解析 `resolvedKind`
  - `success` 定義：`resolvedKind !== 'unknown'`
- **Response** `201`
  - `{ id: string, resolvedKind: "posOrder" | "receivingNote" | "unknown", success: boolean, createdAt: string }`

### 3.1b 點擊審計列表 `GET /ops/reports/click-audit`（stable）

- **Query（節錄）**
  - `from?`、`to?`：ISO datetime（以 `createdAt` 篩選）
  - `source?`：交叉篩選
  - `resolvedKind?`：交叉篩選
  - `success?`：`true|false`
  - `referenceId?`：精確比對
  - `resultCode?`：精確比對（例如 `NOT_FOUND`、`MULTI_MATCH`）
- **排序**
  - `sort=createdAt&order=desc`（預設）

### 3.1c 點擊審計彙總 `GET /ops/reports/click-audit/summary`（stable）

- **用途**：給前端做「可觀測性視覺化」：哪些 source 最常失敗、近期趨勢、最常失敗的 referenceId。
- **Query**
  - 同列表的 `from/to/source/resolvedKind/success`（用於交叉篩選）
  - `days?`：未帶 `from/to` 時使用（預設 14，最大 180）
  - `top?`：排行筆數（預設 20，最大 200）
- **Response（新增欄位）**
  - `topSources[]`：`{ source, notFound, multiMatch, total }`（以 `NOT_FOUND/MULTI_MATCH` 聚合排行）
  - `trendByDay[]`：`{ day: "YYYY-MM-DD", total, failed }`
  - `topReferenceIds[]`：`{ field, referenceId, count }`（僅統計 `success=false`）
  - `health`：健康分數與門檻判定（視覺化用）
    - `notFoundRate` / `multiMatchRate` / `navigatedRate`
    - `status`：`OK | WARN | ALERT`
    - `thresholds`：前端顯示用門檻（warn/alert）
  - `fixHints[]`：`{ fixHint, count }`（將 `resultCode` 映射成「下一步」分類）
    - `DATA_MISSING`（多為 NOT_FOUND）
    - `NEEDS_DISAMBIGUATION`（多為 MULTI_MATCH）
    - `PERMISSION`
    - `OK`（多為 NAVIGATED）

### 3.2 Job 列表：from/to 篩選 `GET /ops/jobs`（stable）

- **Query**
  - `from?`、`to?`：ISO datetime（以 `OpsJobRunLog.createdAt` 篩選）
- **行為（含邊界）**
  - 只帶 `from`：回傳 `createdAt >= from`
  - 只帶 `to`：回傳 `createdAt <= to`
  - 同時帶 `from` 與 `to`：回傳 `from <= createdAt <= to`
  - `from > to` 或任一無法解析為日期：回 `400` `REPORT_INVALID_RANGE`

### 3.3 Job 列表：錯誤摘要欄位 `messageSummary`（stable）

- **用途**：列表頁顯示錯誤摘要，避免長訊息或換行造成表格破版。
- **規則**
  - 若 `message` 為 `null` → `messageSummary=null`
  - `messageSummary` 會先將 `\r\n`／`\n` 與連續空白**正規化為單一空白**並 `trim()`
  - 正規化後長度 **> 200** 時：取前 200 字 + `…`
  - 長度 **<= 200** 時：原樣回傳（正規化後）

### 3.4 手動補跑 `POST /ops/jobs/run`（stable）

- **用途**：後台手動觸發部分 job（通常用於排程失敗時補跑），並統一寫入 OpsJobRunLog。
- **保護**：需 `X-Admin-Key`
- **Body**
  - `kind`：`crm-run-scheduled`｜`finance-snapshot`
  - `asOfDate?`：僅 `finance-snapshot` 使用（YYYY-MM-DD；未帶預設今天）
  - `snapshotType?`：僅 `finance-snapshot` 使用（`daily`｜`monthly`；未帶預設 `daily`）

---

## 四、階段總覽

| 階段 | 主題 | 後端核心 | 前端核心 |
|------|------|----------|----------|
| **Phase 1** | Job 紀錄 | OpsJobRunLog、recordRun、getStatus | 發券規則頁 job 狀態區塊 |
| **Phase 2** | 列表查詢 | GET /ops/jobs 分頁、kind 篩選 | Job 監控頁雛形 |
| **Phase 4** | 監控頁完整 | 錯誤訊息摘要、from/to 篩選 | /admin/ops/jobs 完整 UI |

---

## 五、與現況對照

### 5.1 已實作

| 項目 | 後端 | 前端 | 備註 |
|------|------|------|------|
| OpsJobRunLog | schema、recordRun | — | 完成 |
| GET /ops/jobs/status | 各 job 最近狀態 | 發券規則頁 job 狀態 | 完成 |
| GET /ops/jobs | 分頁、kind 篩選 | AdminOpsJobsPage | 完成 |

### 5.2 未實作或選配

| 項目 | 說明 |
|------|------|
| 手動補跑 | 依產品需求可選配 |
| from/to 日期篩選 | 已實作（GET /ops/jobs query: from/to，createdAt 區間） |

### 5.3 相關文件對照

| 文件 | 覆蓋範圍 |
|------|----------|
| [deploy-preview.md](deploy-preview.md) | job 狀態契約 |
| [erp-roadmap.md](erp-roadmap.md) | Phase 4 Job 監控頁 |
| [crm-member-roadmap.md](crm-member-roadmap.md) | dispatch-rules、發券 job |
