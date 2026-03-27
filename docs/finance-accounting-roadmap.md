# 財務會計 — 整合型規格與開發計畫

本文件為**財務／金流／會計**的單一總覽：先給出完整好用的規格與開發計畫，最後一節對照目前專案已實作項目。核准後可依此調整 BACKEND/FRONTEND INSTRUCTIONS，並收斂散落於他處的重複描述。

---

## 一、目標與範圍

### 1.1 目標

- **金流事件為唯一事實來源**：所有應收、應付、實收、退款、調整皆以 **FinanceEvent** 寫入，不允許 UPDATE/DELETE，僅能 INSERT 新事件或補償事件。
- **可稽核、可還原**：任一時點餘額可由事件表重算；必要時可產出報表快照供對帳與稽核。
- **與業務模組解耦**：POS、採購、退貨等不直接寫入金流表，僅透過 **FinanceService.recordFinanceEvent** 或 **POST /finance/events** 寫入。

### 1.2 範圍

| 範圍 | 說明 |
|------|------|
| **金流事件** | 銷售應收／實收／退款、採購應付／退供、人工調整；事件型別與欄位見 §三。 |
| **查詢與匯出** | 列表（分頁、篩選）、CSV 匯出；篩選維度含 type、partyId、referenceId、日期區間。 |
| **報表與前端** | 後台金流報表頁：篩選、表列、可選彙總區塊與圖表、匯出 CSV。 |
| **應收應付彙總** | 依 partyId（客戶／供應商）或 type 彙總餘額；供報表摘要與對帳。 |
| **關帳與審計** | 選配：關帳期間鎖定、Audit Log、報表快照。 |

---

## 二、設計原則（與不可變性設計對齊）

- **事件表 append-only**：FinanceEvent 僅 INSERT；不提供 UPDATE/DELETE API。
- **修正僅能補償**：沖銷或調整皆以新事件（如 SALE_REFUND、ADJUSTMENT）寫入。
- **匯總為投影**：若有應收應付餘額表，僅能由服務依事件滾算或重算，不提供手動改餘額的 API。
- **單一寫入入口**：POS、採購、退貨等模組呼叫 `FinanceService.recordFinanceEvent` 或 `POST /finance/events`，不直接寫 DB。

詳細原則與雙軌、備援見 [inventory-finance-immutability.md](inventory-finance-immutability.md)。

---

## 三、金流事件型別與寫入來源

### 3.1 事件型別（FinanceEventType）

| type | 說明 | 典型寫入來源 |
|------|------|--------------|
| **SALE_RECEIVABLE** | 銷售應收（訂單總額） | POS createOrder |
| **SALE_PAYMENT** | 銷售實收（一筆付款一筆） | POS createOrder（allowCredit 時）、POST /pos/orders/:id/payments 補款 |
| **SALE_REFUND** | 銷售退款 | POST /pos/orders/:id/refunds |
| **PURCHASE_PAYABLE** | 採購應付（驗收合格金額） | 驗收 complete（ReceivingNote complete） |
| **PURCHASE_RETURN** | 退供應商（沖應付） | POST /receiving-notes/:id/return-to-supplier |
| **PURCHASE_REBATE** | 採購折讓（選配） | 手動或供應商 credit note |
| **ADJUSTMENT** | 人工調整 | 後台或整合寫入，需稽核 |

### 3.2 事件欄位（FinanceEvent）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid | 主鍵 |
| type | FinanceEventType | 上表 |
| partyId | string? | 金流對象（Party）識別；**對外一律使用小寫前綴**：`customer:{customerId}`、`supplier:{supplierId}`（其他對象後續擴充）；可空 |
| currency | string | 例 TWD |
| amount | number | 金額（正數；退款、退供仍以正數表示） |
| taxAmount | number? | 稅額 |
| occurredAt | ISO datetime | 業務發生時間 |
| referenceId | string? | 關聯單據 id（如 PosOrder id、ReceivingNote id） |
| note | string? | 備註 |
| createdAt | ISO datetime | 寫入時間 |

---

## 四、API 規格（完整）

### 4.1 寫入

| Method | Path | 說明 |
|--------|------|------|
| POST | /finance/events | 新增一筆金流事件（body：type、partyId、currency、amount、taxAmount?、occurredAt?、referenceId?、note?）。由 POS／採購等模組或後台呼叫。 |

### 4.2 查詢

| Method | Path | 說明 |
|--------|------|------|
| GET | /finance/events | 只讀、分頁。Query：**partyId**、**referenceId**、**type**、**from**／**to**（occurredAt 區間）、**preset=last30d**（未帶 from/to 時近 30 日）、**page**（預設 1）、**pageSize**（預設 50，上限 100）。回應：PagedResult&lt;FinanceEvent&gt;。 |

### 4.3 匯出

| Method | Path | 說明 |
|--------|------|------|
| GET | /finance/events/export | CSV；Query 同 §4.2（不含 page/pageSize）；列數上限 10_000；UTF-8 BOM；Content-Disposition attachment。需 X-Admin-Key（若已設 ADMIN_API_KEY）。 |

### 4.4 彙總（規劃）

| Method | Path | 說明 |
|--------|------|------|
| GET | /finance/summary | **規劃**。Query：from、to、preset?、groupBy=type｜partyId。回應：依 type 或 partyId 彙總之金額（例：SALE_RECEIVABLE 總和、SALE_PAYMENT 總和、各 partyId 應收/應付餘額）。若 groupBy=partyId 可對應 ArApSummary 概念。 |

以上 4.1～4.3 為穩定契約；4.4 為後續階段，實作前須補入 [api-design-inventory-finance.md](api-design-inventory-finance.md) 或本檔並標版本。

---

## 五、報表與前端規格（完整）

### 5.1 金流報表頁（/admin/reports）

| 項目 | 規格 |
|------|------|
| **資料來源** | GET /finance/events（分頁）、GET /finance/events/export（匯出）。 |
| **篩選** | **區間**：近 30 日／全部／自訂 from～to。**類型（type）**：下拉或多選（SALE_RECEIVABLE、SALE_PAYMENT、SALE_REFUND、PURCHASE_PAYABLE、PURCHASE_RETURN、ADJUSTMENT 等），對應 API query `type`。**對象（partyId）**：選填，對應 API query `partyId`。 |
| **表列** | 欄位：時間、**類型**、金額、幣別、referenceId、備註；可選 partyId（需後端或 join 提供對象名稱）。支援分頁。 |
| **匯出** | 按鈕「匯出 CSV」：呼叫 GET /finance/events/export，參數與當前篩選一致（含 type、from/to、preset）；需 Admin Key 時按鈕可 disabled 或 toast 提示。 |
| **彙總區塊** | 選配：區間內「應收合計」「實收合計」「應付合計」「退供合計」等，可依 GET /finance/summary 或前端依列表計算。 |
| **圖表** | 選配：依 type 或日期的長條圖／折線圖。 |

### 5.2 與訂單報表分工

- **金流報表**：以金流事件為主（應收、實收、應付、退款等）。
- **訂單報表**：以 POS 訂單為主（銷售筆數、金額、明細）；日期篩選與匯出見 POS 訂單查詢或 GET /pos/orders/export。兩者可在同一後台「報表」入口下分 Tab 或子頁。

---

## 六、應收應付彙總（已實作）

### 6.1 概念（對齊 inventory-finance-immutability）

- **AccountBalance / ArApSummary**：依 **partyId**（客戶或供應商）彙總「應收餘額」「應付餘額」；可由事件表重算：  
  - 應收 = Σ(SALE_RECEIVABLE) − Σ(SALE_PAYMENT) − Σ(SALE_REFUND) 等；  
  - 應付 = Σ(PURCHASE_PAYABLE) − Σ(PURCHASE_RETURN) − Σ(PURCHASE_REBATE) 等。
- **匯總表為投影**：可為快取或實體表，但須由服務依事件更新，不提供手動改寫 API。

### 6.2 API（已實作）

- **GET /finance/summary**：已支援 `groupBy=type`、`groupBy=partyId`、`groupBy=day`、`groupBy=week`；見 api-design-inventory-finance。
- **GET /finance/balances**：已實作；依 merchantId（必填或單一商家時自動帶入）查詢應收／應付餘額；支援 **partyId**（精確）、**kind**（customer/supplier）、**q**（`Party.displayName` 模糊）、**page**／**pageSize**（上限 100）；回傳 **items**、**total**、**totals** 等；與事件表可重算一致。詳見 **api-design-inventory-finance.md §5.0d**。

### 6.3 Party 視圖（決策：已採用）

- **單一真實來源**：以資料表 `Party` 作為 canonical（包含 `merchantId`、`kind`、`displayName`），供多商家隔離與前端顯示。
- **partyId 格式（對外）**：`customer:{customerId}`、`supplier:{supplierId}`（小寫前綴）。
  - 若出現無前綴的 legacy 值，僅視為相容讀取；新寫入與文件契約以「一律前綴」為準。

---

## 七、關帳與審計（已實作）

| 項目 | 說明 |
|------|------|
| **關帳** | 定義關帳期間（起訖日）；關帳後該期間內不得新增／調整事件；解鎖需 Audit。 |
| **Audit Log** | 每次寫入金流時紀錄操作者、時間、來源、關聯事件 id；可存於獨立日誌或 DB。 |
| **報表快照** | 關鍵時點（日結／月結）產出不可變檔案（如 finance-summary.json）存於物件儲存。 |

以上見 [inventory-finance-immutability.md](inventory-finance-immutability.md) §3.3、§4、§5。以下為**實作規格 draft**，實作前請擇定選項並寫回本檔。

### 7.1 關帳 — 表結構與 API（draft）

**與現有 events 的互動**：關帳後，凡 `eventTime`（或 `createdAt`）落在該期間內的 **FinanceEvent**，不得再 **INSERT** 新事件、也不得對既有事件做 UPDATE/DELETE。寫入時（`recordFinanceEvent`）檢查是否有「包含該時間」的已關帳期間，若有則拒絕並回傳錯誤碼（如 `FINANCE_PERIOD_CLOSED`）。

**決策一：表結構** — **已採用 C1**

| 選項 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **C1** ✓ | 新增 **FinancePeriodClose**（或 `ClosingEvent`）：id、merchantId?、startDate、endDate（皆 Date）、closedAt、closedBy、status（CLOSED｜UNLOCKED） | 一表一筆關帳紀錄、易查「某日是否在關帳區間」 | 需索引 (startDate, endDate) 或 (merchantId, startDate, endDate) |
| **C2** | 同一表但支援「多段關帳」（如 1 月、2 月各一筆）；解鎖時將該筆 status 改為 UNLOCKED 並寫入 Audit | 可分段關帳、彈性高 | 查詢時需取「所有 CLOSED 且涵蓋該日」的區間 |

- **採用**：**C1**。實作時新增 **FinancePeriodClose** 表（或同名 migration），索引建議 (merchantId, startDate, endDate) 若為多商家。

**API（draft）**

- **POST /finance/periods/close**（Admin）：body `{ startDate, endDate }`（ISO 日期）；建立關帳紀錄並檢查該區間內無「未關帳前的異動」；成功回傳 `{ id, startDate, endDate, closedAt }`。若該區間與既有關帳重疊或含已關帳日 → 400 `FINANCE_PERIOD_OVERLAP` 或 `FINANCE_PERIOD_ALREADY_CLOSED`。
- **POST /finance/periods/:id/unlock**（Admin）：將該筆關帳改為 UNLOCKED，並寫入 Audit Log（誰、何時解鎖、原因可選填）。僅限高權限或特定角色（實作時訂）。
- **GET /finance/periods**：query `merchantId?`、`status?`（CLOSED｜UNLOCKED）；回傳關帳列表，供前端顯示「已關帳區間」與解鎖按鈕。

**錯誤碼**：`FINANCE_PERIOD_CLOSED`（寫入事件時該時間已關帳）、`FINANCE_PERIOD_OVERLAP`、`FINANCE_PERIOD_ALREADY_CLOSED`、`FINANCE_PERIOD_NOT_FOUND`（unlock 時）；見 backend-error-format。

### 7.2 Audit Log — 儲存與寫入時機（draft）

**寫入時機**：每次成功呼叫 `recordFinanceEvent`（或 POST /finance/events）後，同步寫一筆 Audit 紀錄。欄位建議：操作者（userId／system）、操作時間、來源（POS｜ADMIN｜IMPORT｜API）、關聯 FinanceEvent id、金額與 type 摘要（可選）。

**決策二：儲存與查詢** — **已採用 A1**

| 選項 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **A1** ✓ | 同一 DB 新增 **FinanceAuditLog** 表；寫入時一併 insert | 實作簡單、可與關帳同 DB 查詢 | 金流與 audit 同庫，若要做獨立歸檔需再搬 |
| **A2** | 獨立儲存（檔案、Log Server、SIEM）；應用層寫入後非同步送出 | 與業務 DB 分離、利合規 | 需維運另一管道、查詢需另做介面 |
| **A3** | 同 A1，但**不提供查詢 API**，僅供內部／DBA 查詢 | 實作成本低、仍可稽核 | 後台無法「查某筆事件誰寫的」需直接查 DB |

- **採用**：**A1**。實作時新增 **FinanceAuditLog** 表，並提供 **GET /finance/audit-log**（Admin，query：eventId、from、to、actor）僅讀。

### 7.3 報表快照 — 觸發與儲存（draft）

**目的**：日結／月結時產出一份不可變的彙總（如依 partyId 的應收應付、或 summary by type），存成檔案供對帳與稽核。

**決策三：觸發方式** — **已採用 S3**

| 選項 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **S1** | **API**：**POST /finance/snapshots**（Admin）body `{ asOfDate, type: daily | monthly }`，同步產出並回傳檔名／路徑或上傳至物件儲存後回傳 URL | 可與「關帳」流程整合（先關帳再快照） | 需手動或排程呼叫 |
| **S2** | **Cron**：每日固定時間（如 00:05）自動產出前一日快照；不提供「手動觸發」API | 不需後台操作 | 彈性低、除錯時無法重跑某日 |
| **S3** ✓ | **S1 + S2**：既有 cron 自動日結；另提供 POST 手動觸發（含 asOfDate）供補跑或月結 | 彈性與自動化兼顧 | 實作稍複雜 |

- **採用**：**S3**。cron 做日結（如每日 00:05 產出前一日）；**POST /finance/snapshots**（Admin）body `{ asOfDate, type: daily | monthly }` 供手動補跑或月結。

**查看/下載閉環（最小可用）**：

- **GET /finance/snapshots**（Admin）：列表（支援 `type`、分頁），回 `{ items, page, pageSize, total }`。
- **GET /finance/snapshots/:id**（Admin）：單筆查看，回 `{ id, asOfDate, type, path, generatedAt, summary, createdAt }`。
- **GET /finance/snapshots/:id/download**（Admin）：下載 JSON（對帳/留存用）。

**決策四：儲存介面與檔名** — **已採用 F2**

| 選項 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **F1** | 寫入**本地檔案**（如 `./snapshots/finance-YYYY-MM-DD.json`）；部署時掛 volume 或 NFS | 無額外依賴 | 多 instance 需共用磁碟；備份需自訂 |
| **F2** ✓ | 上傳至**物件儲存**（S3／GCS／minio）；檔名 `finance/{merchantId?}/YYYY-MM-DD.json`，版本可選 overwrite 或 versioned | 可擴充、多 instance 友善 | 需設定儲存與權限 |
| **F3** | 僅寫入 DB 的 **Snapshot** 表（JSON 或壓縮 blob），不落檔 | 查詢方便、無檔案維運 | 非「獨立檔案」、合規解讀可能不同 |

- **採用**：**F2**。快照上傳至物件儲存；檔名規則 `finance/{merchantId?}/YYYY-MM-DD.json`（日結）、`finance/{merchantId?}/YYYY-MM.json`（月結）；內容含 `asOfDate`、`generatedAt`、`byType`／`byParty` 等與 GET /finance/summary 一致之結構。實作時需設定儲存 bucket、credentials 與權限。

---

## 八、開發階段（完整計畫）

| 階段 | 交付內容 | 後端 | 前端 |
|------|----------|------|------|
| **Phase 1** | 事件寫入與查詢 | POST /finance/events；GET /finance/events（分頁、partyId、referenceId、**type**、from/to、preset）；GET /finance/events/export。寫入來源：POS（SALE_*）、採購驗收（PURCHASE_PAYABLE）、退供應商（PURCHASE_RETURN）、退款（SALE_REFUND）。 | 不直接呼叫 /finance/*（由 POS／後台流程間接寫入）；可選後台「金流報表」僅讀列表。 |
| **Phase 2** | 報表維度與篩選 | 確保 GET/export 支援 **type** 篩選並於契約註明。 | 金流報表頁：區間（preset/from/to）、**type 篩選**、表列（含 type 欄）、匯出 CSV（參數含 type）。 |
| **Phase 3** | 彙總與報表進階 | GET /finance/summary（groupBy=type 或 partyId）；或依事件表即時彙總。契約與錯誤碼補齊。 | 金流報表頁：彙總區塊（應收／實收／應付／退供等）；可選簡單圖表（依 type 或日期）。 |
| **Phase 4** | 應收應付餘額與關帳 | 可選 ArApSummary 表或視圖、GET /finance/balances；關帳表與鎖定邏輯。 | 可選「應收應付餘額」查詢頁、關帳操作（需權限）。 |

---

## 九、對照現有實作

以下為本文件規格與**目前專案已實作**之對照。核准本 roadmap 後，可依此更新 INSTRUCTIONS 並收斂他處重複內容。

### 9.1 後端

| 項目 | 狀態 | 說明 |
|------|------|------|
| POST /finance/events | **已實作** | FinanceController、FinanceService；型別驗證、recordFinanceEvent。 |
| GET /finance/events | **已實作** | Query：partyId、referenceId、**type**、from、to、preset、page、pageSize。 |
| GET /finance/events/export | **已實作** | Query 同 list；1 萬列上限；BOM；AdminApiKeyGuard。 |
| 寫入來源 — POS | **已實作** | createOrder 寫 SALE_RECEIVABLE、SALE_PAYMENT；refunds 寫 SALE_REFUND。 |
| 寫入來源 — 採購驗收 | **已實作** | ReceivingNote complete 寫 PURCHASE_PAYABLE。 |
| 寫入來源 — 退供應商 | **已實作** | return-to-supplier 寫 PURCHASE_RETURN。 |
| GET /finance/summary | **已實作** | 支援 groupBy=type、groupBy=partyId、preset、from/to；回傳 byType 或 byParty 彙總。 |
| 應收應付餘額表／API | **已實作** | GET /finance/balances；回傳 `{ items, page, pageSize, total, totals }`，items 為 `{ partyId, receivable, payable, displayName?, kind? }[]`；支援 **partyId**（精確）、**kind**、**q**（displayName 模糊）、分頁（pageSize≤100）；**單一商家 merchantId fallback**：未傳 merchantId 且 DB 僅一筆 Merchant 時自動使用。 |
| 關帳／Periods／Audit／Snapshot | **已實作** | GET/POST /finance/periods（close/unlock）、GET /finance/audit-log、POST /finance/snapshots、GET /finance/snapshots（list/get/download）；integration-spec 已涵蓋。 |

### 9.2 前端

| 項目 | 狀態 | 說明 |
|------|------|------|
| 金流報表頁 /admin/reports | **已實作** | AdminReportsPage：GET /finance/events、分頁、preset（last30d/all/custom）、from/to、匯出 CSV。 |
| 金流報表 — type 篩選 | **已實作** | 後端 GET /finance/events 支援 type 查詢；前端可接入。 |
| 金流報表 — partyId 篩選 | **已實作** | 後端 GET /finance/events 支援 partyId 查詢；前端可接入。 |
| 金流報表 — 彙總區塊 | **已實作** | 後端 GET /finance/summary 支援 groupBy=type／partyId；前端可接入。 |
| 金流報表 — 圖表 | **未實作** | 選配。 |
| 訂單報表與金流分工說明 | **已實作** | 頁面說明「訂單報表與日期篩選請至 POS → 訂單查詢」。 |

### 9.3 契約與文件

| 項目 | 狀態 | 說明 |
|------|------|------|
| api-design-inventory-finance.md | **已有** | §5 為 Finance API 詳細規格；§5.0d GET /finance/balances 含回傳格式、Query（partyId、kind、**q**、page／pageSize 上限 100）、Response 範例；integration-spec 涵蓋 balances 測試。 |
| inventory-finance-immutability.md | **已有** | 原則與雙軌、關帳、Audit、備份；本 roadmap §二、§六、§七 引用即可。 |
| api-design.md §4 金流 | **draft** | 簡短；可改為「詳見 api-design-inventory-finance 與 finance-accounting-roadmap」。 |

---

## 十、核准後建議動作（已執行）

以下已於**核准本 roadmap 後**執行：

1. **BACKEND-INSTRUCTIONS §1**：依 Phase 2／3 填入「金流 type 維度確認」與「GET /finance/summary 彙總 API」之必做或選配；若後端 type 已齊全則改為「契約與前端對齊」。
2. **FRONTEND-INSTRUCTIONS §1**：依 Phase 2 填入「金流報表 type 篩選」必做；Phase 3 彙總區塊／圖表為選配。
3. **progress/integrated-last-cycle.md**：財務會計缺口改為引用本檔 §八、§九，可刪除或縮短重複的「財務會計（金流進階）」長段描述。
4. **tasks/MODULE-OPTIMIZATION.md**：金流報表一行「採購應付接上後報表維度補一欄 type」改為「見 docs/finance-accounting-roadmap.md Phase 2／§九」。
5. **其他**：api-design.md §4 金流已改為連結本檔與 api-design-inventory-finance；progress、MODULE-OPTIMIZATION 已收斂重複描述。

---

**文件版本**：初版；對照現有實作以 2026-03 專案狀態為準。§十 已於核准後執行。
