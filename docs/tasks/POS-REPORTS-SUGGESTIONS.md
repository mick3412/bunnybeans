# POS 報表 — 更多銷售細節與時間區段建議

本檔為「報表 今日業績概覽」頁的**產品建議**與**實作方向**，對應畫面：`/pos/reports`、資料來源 **GET /pos/reports/summary**。

---

## 一、更多銷售細節 — 建議項目與優先級

目前僅有四張 KPI 卡（營收合計、訂單筆數、平均客單、退款筆數），缺乏單筆交易、品項、付款方式、趨勢等。建議依下表擴充（可分期實作）。

| 優先級 | 項目 | 說明 | 後端 | 前端 |
|--------|------|------|------|------|
| **P0** | **區間內訂單列表** | 所選時間區段內的訂單一覽：單號、時間、金額、客戶；可點進詳情或跳轉 `/pos/orders/:id` | 沿用 **GET /pos/orders**，query 帶 `from`、`to`（與報表區間一致）、`storeId?`、`page`、`pageSize` | 報表頁新增「銷售明細」區塊：表列訂單，欄位 orderNumber、createdAt、totalAmount、customerName；Link 至訂單詳情 |
| **P0** | **時間區段設定** | 見下方「二、時間區段設定」 | summary API 支援 preset／from+to | 下拉或 Tab：今日、近7日、近30天、當月、近60天、近半年 |
| **P1** | **付款方式分布** | 區間內「現金／刷卡／轉帳／電子支付」各別金額或筆數 | **GET /pos/reports/summary** 擴充回傳 **byPaymentMethod**：`{ CASH: amount, TRANSFER: amount, ... }`（由 PosOrderPayment 彙總） | 在 KPI 下方加「付款方式」區塊：長條圖或表格顯示各 method 金額／占比 |
| **P2** | **銷售品項排行** | 區間內銷量或營收前 N 名商品（可選依數量或依金額） | 新端點 **GET /pos/reports/top-items**（query：from、to、storeId?、limit、sortBy=quantity｜revenue）或 summary 擴充 **topItems**；由 PosOrderItem 彙總 | 「熱銷品項」區塊：表列商品名、數量、金額 |
| **P2** | **分類銷售** | 依商品分類（category）彙總營收或筆數 | 需 JOIN Product / Category；新端點或 summary 擴充 **byCategory** | 「分類銷售」區塊：表或長條圖 |
| **P3** | **區間內趨勢** | 區間內「按日」或「按小時」營收／單數（折線圖或長條圖） | 新端點 **GET /pos/reports/daily**（query：from、to、storeId?）回傳 `{ date, revenue, ordersCount }[]`；或 summary 擴充 **byDay** | 簡單折線圖或長條圖（依日） |

**實作順序建議**：先做 **時間區段** + **區間內訂單列表**（皆可沿用或小擴充既有 API），再依需求做付款分布、品項排行、趨勢。

---

## 二、時間區段設定 — 規格建議

### 2.1 行為

- **預設**：**今日**（與現行一致）。
- **可選**：近7日、近30天、當月、近60天、近半年；必要時可再加「自訂日期區間」（from～to 日期選擇器）。

### 2.2 後端 API 擴充

**GET /pos/reports/summary** 改為接受 **Query**：

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| **preset** | string | 與 from/to 二擇一 | `today`（預設）、`last7d`、`last30d`、`currentMonth`、`last60d`、`lastHalfYear` |
| **from** | ISO 日期 | 與 preset 二擇一 | 區間起日（00:00:00） |
| **to** | ISO 日期 | 與 from 搭配 | 區間迄日（23:59:59 或次日 00:00:00 開區間） |
| **storeId** | string | 選填 | 限定門市 |

- **preset 對應區間**（以伺服器當前日期為基準）：
  - `today`：當日 00:00～次日 00:00
  - `last7d`：過去 7 天（含今日）
  - `last30d`：過去 30 天（含今日）
  - `currentMonth`：當月 1 日 00:00～次月 1 日 00:00
  - `last60d`：過去 60 天（含今日）
  - `lastHalfYear`：過去 180 天（含今日）
- 未帶任何參數時視同 **preset=today**。
- 回傳可加上 **period** 供前端顯示標題，例如：`{ period: { preset: "last7d", from: "2026-03-10", to: "2026-03-16" }, totalRevenue, ordersCount, ... }`。

### 2.3 前端 UI 建議

- 在「今日業績概覽」**標題列同一行或上方**新增「時間區段」選擇：
  - **做法 A**：下拉選單（Select）— 今日、近7日、近30天、當月、近60天、近半年。
  - **做法 B**：Tab 切換 — 同上選項，預設選「今日」。
- 選定後以 **preset**（或 from/to）呼叫 **GET /pos/reports/summary**，並以相同 **from/to** 呼叫 **GET /pos/orders**（訂單列表區塊）。
- **標題**隨區段更新，例如：「業績概覽（2026/3/10～2026/3/16）」或「業績概覽 — 近7日」。
- 若實作「自訂區間」：可再加「自訂」選項，展開日期選擇器 **from**、**to**，改帶 query **from**、**to** 不打 preset。

---

## 三、與現有實作對照

| 項目 | 現況 | 建議 |
|------|------|------|
| GET /pos/reports/summary | 無 query；固定「本日」 | 新增 query **preset**／**from**／**to**／**storeId**；回傳可加 **period** |
| PosReportsService.todaySummary() | 僅算當日 | 抽成 **summary(filter: { from, to, storeId? })**，由 controller 依 preset 或 from/to 換算 from、to 再呼叫 |
| 報表頁標題 | 固定「今日業績概覽」 | 依區段顯示「業績概覽（起～訖）」或「業績概覽 — 近7日」 |
| 訂單列表 | 無 | 報表頁加區塊，**GET /pos/orders?from=&to=&page=1&pageSize=20** |

契約與錯誤碼更新後請同步至 **api-design-pos.md**（報表 API 小節）與 **backend-error-format.md**（若有新增）。
