# POS ERP 全站 UI/UX 審視與優化方向

> 以 20 年 B2B 產品經驗、簡潔設計、全站風格與視覺統一、實用與美觀平衡為準則，對目前前端 UI 進行完整審視並提出優化方向。實作時請維持現有規格與功能不變，僅在視覺、一致性与體驗上優化。

---

## 一、審視總覽

| 維度 | 現況簡評 | 優先級 |
|------|----------|--------|
| 色系與語意 | 主色／側欄／背景已對齊原則，但仍有頁面使用舊色或未用 design token | 高 |
| 版面與網格 | 主內容區 max-width 不統一（4xl～7xl），缺少單一內容網格 | 高 |
| 字階與文字色 | 混用 neutral-900／slate-800／#1e293b；neutral-500／#64748b 未全統一 | 高 |
| 元件與重複使用 | 按鈕／卡片／空狀態／載入態未全用共用元件或統一樣式 | 中 |
| 間距與節奏 | padding／margin／gap 各頁不一，缺少明確 spacing scale | 中 |
| 表單與焦點 | 多數已主色 focus，部分 select／tab 仍為藍／紫本體色 | 高 |
| 空狀態與回饋 | 空狀態、錯誤、成功樣式未全站統一 | 中 |
| 無障礙與鍵盤 | focus 可見性已有，尚缺統一 skip link、部分 aria 與鍵盤動線 | 中 |
| POS 與 Admin 一致性 | 殼層與主色已統一，細節（如按鈕圓角、陰影）可再對齊 | 低 |

---

## 二、色系與 Design Token

### 2.1 已對齊

- 側欄 `#1e293b`、主內容區 `#f1f5f9`、主色 `#0ea5e9`、表格邊框 `#e2e8f0`、表頭 `#f8fafc` 已在 `styles.css` 與多數頁面落實。
- KPI 左色條（藍／綠／橙／灰）與原則一致。

### 2.2 待修正（全站統一用 token）

- **按鈕主色**：採購單、進貨驗收、供應商等頁仍使用 `bg-[#2563EB]`、`bg-[#6366f1]`、`hover:bg-blue-700`、`hover:bg-violet-700`，應改為 `bg-brand-primary`／`hover:bg-brand-primary-hover` 或共用 `Button`。
- **商品頁浮動按鈕與欄寬拖曳**：仍使用 `#7EACB5`，應改為 `#0ea5e9` 或 `brand-primary`。
- **Tab／篩選選中態**：採購單 status tabs 使用 `border-blue-600 text-blue-600`，應改為主色。
- **成功／錯誤區塊**：入庫／盤點等使用 `#E3342F`、`#28A745`，建議改為 `--color-brand-danger` 與原則中的成功綠 `#16a34a`，或於 theme 新增 `--color-success` 統一使用。
- **頂欄與內文**：H1 與日期仍用 `text-neutral-900`、`text-neutral-500`，建議改為 `text-[#1e293b]`、`text-[#64748b]`，與原則主要文字／次要文字一致。

**優化方向**：建立單一來源的 design token（已在 @theme 的沿用），所有按鈕／連結／狀態色只引用 token；替換所有硬編碼 hex。

---

## 三、版面與內容寬度

### 3.1 現況

- 總覽：`max-w-7xl`
- 庫存、客戶 CSV：`max-w-5xl`
- 會員列表、金流報表、採購單、進貨驗收：`max-w-6xl`
- 促銷列表、商家、倉庫／門市：`max-w-4xl`
- 入庫／盤點：`max-w-7xl`
- Loyalty 設定：`max-w-2xl`

同一層級頁面（列表／報表）寬度不一，大螢幕下視覺節奏不統一。

### 3.2 優化方向

- **訂定單一內容網格**：例如「列表／報表類」統一 `max-w-6xl` 或 `max-w-7xl` 置中，「表單／設定類」可為 `max-w-2xl`～`max-w-4xl`。
- **主內容區 padding**：Layout 已用 `p-6`，內層勿再雙重縮進；子頁面最外層建議統一 `mx-auto max-w-*` + 必要時 `px-4` 響應小螢幕。
- **全寬表格**：表格可滿寬於內容區內，不需再套一層不一致的 max-width。

---

## 四、字階與文字語意

### 4.1 原則要求

- 主要文字 `#1e293b`、次要／標籤 `#64748b`；最小字級 12px；內文行高 ≥ 1.5。

### 4.2 待統一

- **標題**：`text-neutral-900` → `text-[#1e293b]`（或 token）。
- **說明與 Caption**：`text-neutral-500`、`text-slate-500`、`text-slate-600` → `text-[#64748b]`。
- **KPI 卡**：MetricCard 的 label／sub 仍用 `text-neutral-500`，改為 `text-[#64748b]`；value 可為 `text-[#1e293b]`。
- **表頭**：部分 thead 仍 `text-slate-600`，改為 `text-[#64748b]` 或沿用表頭專用樣式。
- **字階**：統一使用明確 scale（例如 text-xs / sm / base / lg / xl），避免單獨使用 `text-[11px]`、`text-[10px]` 除非為 Caption；若用則集中定義為 utility 或元件 class。

**優化方向**：全站搜尋並替換 neutral-900／neutral-500／slate-500／slate-600 為語意色；建立 typography 工具類或元件（如 `.text-primary`、`.text-secondary`）減少再次偏離。

---

## 五、元件與模式統一

### 5.1 按鈕

- **主要 CTA**：一律使用 `<Button variant="primary">` 或 `bg-brand-primary`，禁止內聯 `bg-[#2563EB]` 等。
- **危險操作**：刪除等使用 `variant="danger"` 或統一紅系 token；若 Button 尚無 danger，可擴充或使用統一 class。
- **尺寸**：sm / md 統一，避免頁面自訂 py-2.5 等導致高度不一致。

### 5.2 卡片與區塊

- **外框**：統一 `border border-[#e2e8f0] rounded-xl`（或 rounded-lg）；避免 `ring-1 ring-neutral-100` 與邊框語意重複，改為細邊框。
- **內距**：卡片內容建議統一 padding（如 p-4 或 p-5），列表外層與表單區塊一致。
- **KPI 卡**：Dashboard 與 Loyalty 儀表板可抽成共用 `KpiCard`，接受 accent、label、value、sub，避免兩套寫法。

### 5.3 空狀態與回饋

- **空狀態**：統一結構與樣式（圖示或短句 + 說明），例如：「尚無資料」+ 次要文字，padding、字級、顏色一致。
- **錯誤／成功**：錯誤區塊統一邊框與背景（如 border-red-200 bg-red-50 或 token）；成功訊息與原則一致（綠系）。
- **載入**：若有全域或區塊 loading，統一 spinner 或 skeleton 樣式與位置。

### 5.4 表單

- **輸入框**：已用 TextInput 與 focus 主色；未用元件處（select、input）補上 `border-[#e2e8f0]`、`focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20`。
- **Label**：統一 `text-[#64748b]` 或 `text-secondary`，字級一致（如 text-sm 或 xs）。

**優化方向**：建立或補齊共用元件（KpiCard、EmptyState、AlertBox、PageSection）；按鈕與表單僅透過元件或 token 使用，不寫死色碼。

---

## 六、間距與節奏

### 6.1 現況

- 主內容區：Layout main 為 `p-6`。
- 區塊間：mb-4、mb-6、mb-8 混用；gap-2、gap-3、gap-4、gap-6 混用。
- 卡片內：p-4、p-5、p-6 皆有。

### 6.2 優化方向

- **訂定 spacing scale**：例如 4／8／12／16／24／32（對應 Tailwind 1～8），區塊間距以 16 或 24 為主，區塊內以 12～16 為主。
- **區塊標題與內容**：已有 border-b + pb-2，可統一「區塊標題下緣到內容」間距（如 mb-4）。
- **列表頁**：篩選區 → 表格、表格 → 分頁，間距一致（如 mb-4 或 mb-6 擇一）。

---

## 七、表格

### 7.1 已對齊

- 細邊框、表頭淺底、sticky 表頭（.table-sticky-head）已套用於多數列表。

### 7.2 待統一

- **hover 列**：統一為 `hover:bg-[#f8fafc]` 或極淺主色，避免各頁不同。
- **表頭字級**：統一 text-xs 或 text-sm、字重 600、顏色 #64748b。
- **表格外層**：外層容器統一 `rounded-xl border border-[#e2e8f0]`，不混用 ring。

---

## 八、導覽與殼層

### 8.1 後台側欄

- 已改為圖示槽 + 文字同一結構，對齊良好。
- 區段標題（會員／集點、採購）與分隔線已存在；可再檢查「區段標題」與「連結」視覺階層（字級／透明度）是否一致符合原則。

### 8.2 POS 側欄

- 窄欄置中圖示+文字，與後台寬欄左對齊為不同情境，可保留。
- 建議：選中態左線與後台一致使用 `border-brand-primary`，確保主色唯一。

### 8.3 頂欄

- 單一 H1 + 日期已落實；搜尋框、通知等視覺權重適中。
- 建議：H1 與日期改為 token 色（#1e293b、#64748b），與全站文字語意一致。

---

## 九、無障礙與鍵盤

### 9.1 已具備

- focus 可見性（ring、主色）已普遍套用。
- 部分按鈕有 aria-label。

### 9.2 優化方向

- **Skip link**：於 Layout 提供「跳過導覽至主內容」連結，利於鍵盤與螢幕閱讀器。
- **表單**：label 與 input 關聯（for/id）、錯誤訊息與欄位關聯（aria-describedby）。
- **模態框**：focus trap、Esc 關閉、關閉後 focus 回傳觸發元素。
- **列表與操作**：重要操作具備鍵盤可達性與焦點順序合理。

---

## 十、B2B 與實用性

### 10.1 已做得好的

- 列表篩選、匯出、分頁、sticky 表頭、明確區塊標題，利於大量資料操作。
- 無多餘裝飾、中文為主、無 emoji，符合嚴肅後台。

### 10.2 可加強

- **批量操作**：若有勾選多筆，可將「主要動作」固定於表格上方或 sticky 列，避免被捲出視野。
- **確認對話**：刪除等不可逆操作，統一確認方式（例如同一種 modal 或 confirm 文案風格）。
- **數字與金額**：表格內數字、金額統一 `tabular-nums`、對齊方式（右對齊），必要時千分位格式一致。

---

## 十一、優化實作優先順序建議

| 順序 | 項目 | 說明 |
|------|------|------|
| 1 | 按鈕與主色統一 | 所有主要 CTA 與 Tab 選中改為 brand-primary；商品頁浮動鈕與 resize 改主色 |
| 2 | 文字色 token 化 | 全站標題／內文／次要文字改為 #1e293b／#64748b，移除殘留 neutral-500／slate-600 |
| 3 | 內容寬度與網格 | 訂定列表類／表單類 max-width 規則並套用 |
| 4 | 卡片與區塊邊框 | 統一 border-[#e2e8f0]、移除 ring-neutral-100 等重複語意 |
| 5 | 空狀態與 Alert | 統一空狀態、錯誤、成功區塊結構與樣式 |
| 6 | 間距 scale | 區塊間距、卡片內距收斂到固定 scale |
| 7 | 共用元件 | KpiCard、EmptyState、Alert 抽成共用，減少重複與偏離 |
| 8 | 無障礙補強 | Skip link、表單關聯、模態框 focus 與 Esc |

---

## 十二、總結

- **強項**：殼層結構、主色與背景、KPI 左色條、表格細邊框與 sticky 表頭、一頁單一 H1、側欄對齊已對齊原則，B2B 實用性佳。
- **待補**：色碼與按鈕全站 token 化、內容寬度與字階／文字色統一、按鈕／卡片／空狀態元件化與樣式一致、間距節奏與無障礙補強。
- **原則**：所有優化不改變路由、API、表單送出與 E2E 行為；僅在視覺、一致性与可及性上收斂，使全站「像同一套產品」且符合 frontend-ui-principles。

此文件可作為後續迭代的檢查清單與優先順序依據；實作時可依檔內章節逐項替換並迴歸 build 與 E2E。
