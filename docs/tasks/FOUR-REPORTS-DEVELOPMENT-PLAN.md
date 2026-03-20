# 四組報表開發計畫

> 本文件列出「會員營收貢獻」「營收趨勢圖（週/月）」「金流趨勢圖」「客單價分布」四組報表的開發計畫，  
> 目標：協助商家評估會員經營 ROI、掌握旺季與成長軌跡、現金流預測與規劃、優化滿額門檻與組合銷售。

---

## 一、總覽

| 報表 | 商業目標 | 優先序 | 後端變更 | 前端變更 |
|------|----------|--------|----------|----------|
| 會員營收貢獻 | 評估會員經營 ROI | P1 | 新增彙總 | 新增區塊 |
| 營收趨勢圖（週/月） | 掌握旺季與成長軌跡 | P1 | 擴充 daily API | 日/週/月切換 + 圖表 |
| 金流趨勢圖 | 現金流預測與規劃 | P1 | API 已有 | 接入 groupBy=day/week |
| 客單價分布 | 優化滿額門檻與組合銷售 | P2 | 新增 API | 新增區塊 |

---

## 二、報表一：會員營收貢獻

### 2.1 目標
- 呈現「有掛單會員」vs「匿名客」的營收占比與筆數
- 協助商家評估會員經營 ROI

### 2.2 資料來源
- `PosOrder`：`customerId` 有值為會員單，否則為匿名單
- 區間與 preset 與既有 summary 一致

### 2.3 後端開發

| 項目 | 說明 |
|------|------|
| **API** | 擴充 `GET /pos/reports/summary` 回傳 `memberContribution` 欄位；或新增 `GET /pos/reports/member-contribution`（建議擴充 summary，一併取得） |
| **DTO** | `{ memberRevenue: number; memberOrdersCount: number; guestRevenue: number; guestOrdersCount: number }` |
| **邏輯** | `PosOrder` 區間內 `aggregate`：`customerId != null` → 會員；`customerId == null` → 匿名；依 `totalAmount` 加總 |
| **位置** | `pos-reports.service.ts` → `summary()` 內新增查詢 |
| **測試** | `pos-reports.integration-spec.ts` 補一則 |

### 2.4 前端開發

| 項目 | 說明 |
| **頁面** | `PosReportsPage`（業績概覽）或 `AdminPerformancePage` |
| **UI** | 在 KPI 下方新增「會員營收貢獻」區塊：圓餅圖或長條圖，顯示「會員營收 vs 匿名客營收」占比；可加訂單筆數 |
| **資料** | 從 `getPosReportsSummary` 取得 `memberContribution`（若後端擴充 summary） |
| **空態** | 無訂單時顯示「此區間尚無訂單」 |

### 2.5 驗收標準
- 區間內有會員單與匿名單時，正確顯示兩者營收與筆數
- 僅有其一時，另一項為 0
- 時間 preset 切換時資料同步更新

---

## 三、報表二：營收趨勢圖（週 / 月）

### 3.1 目標
- 依「日」「週」「月」切換顯示營收趨勢
- 協助商家掌握旺季與成長軌跡

### 3.2 資料來源
- 既有 `GET /pos/reports/daily` 回傳 `byDay: { date, revenue, ordersCount }[]`
- 週/月：可於前端彙總，或後端擴充

### 3.3 後端開發

| 項目 | 說明 |
|------|------|
| **方案 A（推薦）** | 擴充 `GET /pos/reports/daily` 支援 `groupBy=day|week|month`；`week` 以週一為起點；`month` 以月為單位 |
| **方案 B** | 維持 daily 不變，前端依 `byDay` 自行彙總為週/月（較簡單，但長區間時資料量大） |
| **DTO** | `groupBy=week`：`{ periodStart: "2026-03-17", revenue, ordersCount }`；`month` 同理 |
| **位置** | `pos-reports.service.ts` → `getDaily()` |
| **測試** | `pos-reports.integration-spec.ts` 補 groupBy 測試 |

### 3.4 前端開發

| 項目 | 說明 |
| **頁面** | `PosReportsPage`（業績概覽） |
| **UI** | 既有「日營收趨勢」區塊：新增下拉「依日 / 依週 / 依月」；用 `MiniLineChart` 顯示 |
| **資料** | 若後端支援 groupBy：`getPosDaily({ from, to, merchantId, groupBy: 'week' })`；若方案 B：前端對 `byDay` 做週/月彙總 |
| **互動** | 切換時 re-fetch 或前端重算 |

### 3.5 驗收標準
- 依日、週、月切換正確顯示趨勢
- 與既有時間 preset（今日／近 7 日／近 30 日等）相容
- 圖表標籤可讀（週：顯示週區間；月：顯示 YYYY-MM）

---

## 四、報表三：金流趨勢圖

### 4.1 目標
- 依日或週顯示金流收付趨勢
- 協助商家現金流預測與規劃

### 4.2 資料來源
- **後端已支援**：`GET /finance/summary?groupBy=day`、`groupBy=week` 回傳  
  `{ bucket, items: [{ periodStart, amountsByType }] }`
- 目前前端 `adminApi.getFinanceSummary` 僅支援 `groupBy: 'type' | 'partyId'`，需擴充

### 4.3 後端開發

| 項目 | 說明 |
|------|------|
| **變更** | **無需變更** — Controller / Service / Repository 已支援 `groupBy=day`、`groupBy=week` |
| **注意** | 若需依商家篩選，需確認 `summaryTrend` 是否套用 merchantId；目前 API 可能回傳全庫，需視產品需求補 filter |

### 4.4 前端開發

| 項目 | 說明 |
| **API** | `adminApi.getFinanceSummary` 擴充 `groupBy: 'type' | 'partyId' | 'day' | 'week'`；回傳型別增加 `FinanceSummaryTrend` |
| **型別** | `{ bucket: 'day'|'week'; items: { periodStart: string; amountsByType: Record<string,number> }[] }` |
| **頁面** | `AdminReportsPage`（金流報表） |
| **UI** | 新增「金流趨勢」區塊：切換「依日 / 依週」；折線圖顯示 SALE_RECEIVABLE、SALE_PAYMENT、PURCHASE_PAYABLE 等主要 type |
| **資料** | 與列表同區間（preset / from-to）呼叫 `getFinanceSummary({ from, to, groupBy: 'day' })` |
| **優化** | 目前 `AdminReportsPage` 以 `getFinanceEvents` 取得 500 筆自行彙總為 dailyTrend；可改為 `getFinanceSummary(groupBy=day)` 以減少資料量 |

### 4.5 驗收標準
- 金流報表頁顯示依日/週的收付趨勢圖
- 與區間篩選同步
- 圖例區分不同 type（應收、實收、應付等）

---

## 五、報表四：客單價分布

### 5.1 目標
- 顯示訂單金額區間分布（如 0–200、200–500、500–1000、1000+）
- 協助商家優化滿額門檻與組合銷售

### 5.2 資料來源
- `PosOrder` 區間內 `totalAmount` 分桶統計

### 5.3 後端開發

| 項目 | 說明 |
| **API** | 新增 `GET /pos/reports/order-value-distribution`；或擴充 summary 回傳 `orderValueDistribution` |
| **Query** | 與 summary 一致：preset、from、to、storeId、merchantId |
| **DTO** | `{ buckets: [{ label: string; min: number; max: number; count: number; revenue: number }] }`；bucket 可固定：0–200, 200–500, 500–1000, 1000–2000, 2000+ |
| **邏輯** | 依 `totalAmount` 落入區間分桶，aggregate count 與 sum |
| **位置** | `pos-reports.service.ts` 新增 `getOrderValueDistribution()`；`pos-reports.controller.ts` 新增路由 |
| **契約** | `api-design-pos.md` §4.4 報表區塊補一則 |
| **測試** | `pos-reports.integration-spec.ts` 補一則 |

### 5.4 前端開發

| 項目 | 說明 |
| **頁面** | `PosReportsPage`（業績概覽） |
| **UI** | 新增「客單價分布」區塊：長條圖顯示各區間訂單數與營收；可選顯示數量或金額 |
| **資料** | `getPosOrderValueDistribution({ from, to, merchantId })` |
| **空態** | 無訂單時顯示「此區間尚無訂單」 |

### 5.5 驗收標準
- 區間內訂單正確落入各金額區間
- 圖表可讀，標籤清楚（如 $0–200、$200–500）
- 與時間 preset 同步

---

## 六、實施順序建議

| 階段 | 報表 | 預估工時 | 依賴 |
|------|------|----------|------|
| 1 | 金流趨勢圖 | 0.5d | 無（API 已有） |
| 2 | 營收趨勢圖（週/月） | 1d | 無；可選前端彙總先行 |
| 3 | 會員營收貢獻 | 1d | 無 |
| 4 | 客單價分布 | 1.5d | 無 |

建議先做**金流趨勢圖**（僅前端擴充），再依序完成營收趨勢、會員營收、客單價分布。

---

## 七、API 契約補充（待納入 api-design-pos / api-design-inventory-finance）

### 7.1 會員營收貢獻（擴充 summary）
```text
GET /pos/reports/summary 回傳新增：
memberContribution?: {
  memberRevenue: number;
  memberOrdersCount: number;
  guestRevenue: number;
  guestOrdersCount: number;
}
```

### 7.2 營收趨勢 groupBy（擴充 daily）
```text
GET /pos/reports/daily
Query 新增：groupBy?: 'day' | 'week' | 'month'  // 預設 day
回應：byDay 改為通用 items: { periodStart, revenue, ordersCount }[]
```

### 7.3 金流趨勢（既有）
```text
GET /finance/summary?groupBy=day|week
回應：{ bucket: 'day'|'week', items: [{ periodStart, amountsByType }] }
```

### 7.4 客單價分布（新增）
```text
GET /pos/reports/order-value-distribution
Query: preset, from, to, storeId, merchantId（同 summary）
回應：{ buckets: [{ label, min, max, count, revenue }] }
```
