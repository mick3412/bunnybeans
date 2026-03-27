# Tabs 版型統一規範（INSTRUCTIONS 062）

## 統一格式

- 標題區：tabs 列固定放在內容頂部，使用底線分隔（`border-b`）與下方留白（`pb-3`）。
- tabs 列：使用 `flex-wrap + gap-2`，窄螢幕可換行，不出現水平捲動。
- tab 按鈕：
  - 高度固定 `h-8`
  - 圓角 `rounded-full`
  - 字級 `text-xs`、字重 `font-semibold`
  - 選中態：深色底 + 白字 + ring
  - 未選中：白底 + 灰字 + 細框，hover 為 `bg-table-head`
- 區塊節奏：tabs 下方主內容與 tabs 間距至少 `space-y-4`，避免貼齊。
- URL 同步：hub 類頁面需保留 `tab` query 與路由同步，避免重新整理後落在錯誤分頁。

## 已套用頁面

- `AdminOpsMonitoringHubPage`
- `AdminMemberCenterHubPage`
- `AdminInventoryQueryHubPage`
- `AdminMarketingCenterHubPage`
- `AdminFinanceHubPage`
- `AdminProcurementHubPage`
- `AdminProductHubPage`

## 例外規則與原因

- `AdminInventoryQueryHubPage`：切換 `balances/slowMoving` 時會同步 `invView`，屬於資料查詢子參數耦合，保留既有邏輯。
- `AdminFinanceHubPage`：以 pathname 優先決定 active tab，避免側欄跨路由導覽被舊 query 覆蓋。
- `AdminMemberCenterHubPage`：外層容器需要 `overflow-auto` 以承載 drawer/長表格，不跟其他 hub 共用外層高度策略。
