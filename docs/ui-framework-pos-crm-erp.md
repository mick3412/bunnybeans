# POS/CRM/ERP UI 框架（規格）

> 本文件為全站視覺與互動的單一依據。現代化、清晰簡單、操作直觀、排版善用空間。**介面以中文為主，非必要不展示英文。** 全站無 emoji。色系嚴格採用附圖五色。

---

## 一、色系與語意

全站僅用下列五色（必要時可做明度微調，如 hover）：

| 色名 | Hex | 語意與用途 |
|------|-----|------------|
| **Porcelain 瓷白** | `#F7F7F2` | 全站主背景（canvas）、主內容區底；柔和留白。 |
| **Carbon Black 碳黑** | `#222725` | 導覽錨點：側欄背景、頂欄（可選）、主要文字（標題/內文）、按鈕次要邊框；穩重。 |
| **Bright Teal Blue 亮青藍** | `#197BBD` | 主行動：主要 CTA、連結、Nav 選中強調、focus ring、表單重點。 |
| **Jungle Green 叢林綠** | `#0DAB76` | 成功/完成狀態、次要區塊邊框、資訊提示、表格隔行或 hover 輔助。 |
| **Berry Crush 莓紅** | `#AA4465` | 警示與強調：折扣/促銷標籤、警告、刪除或危險操作（小面積）、數值負向或需注意。 |

**規則**：大面積僅 Porcelain 與 Carbon Black；Bright Teal Blue / Jungle Green / Berry Crush 用於焦點與狀態，不整版鋪底。卡片底可用白（#FFFFFF）與 Porcelain 區隔。

---

## 二、殼層（Shell）

- **側欄**：背景 Carbon Black；寬度固定（約 12rem～14rem）。導覽項目文字白或淺灰；**選中**：背景略深或左側 Bright Teal Blue 豎條（2～3px）。Hover：Porcelain 或 White 低不透明度。
- **頂欄**：Porcelain 底、下邊框 Carbon Black 極細線；或與側欄同 Carbon Black。放置：頁標題（單一 H1）、日期/篩選、全域操作（如「回 POS」）。
- **主內容區**：Porcelain 底；內邊距一致（約 1.5rem～2rem）；單欄或雙欄依頁型。內容區最大寬可設 max-width（如 1440px）置中；表格/表單使用緊湊但可讀的 padding。

---

## 三、字體與字階

- **字型堆疊**：西文 `system-ui, ui-sans-serif, Segoe UI`；中文 `PingFang TC, Microsoft JhengHei, Noto Sans TC`；後備 `sans-serif`。
- **字階**：一頁內單一頂層標題，其餘依層級遞減。

| 級別 | 用途 | 建議 | 字重 |
|------|------|------|------|
| **H1** | 頁級標題（頂欄或主區頂端唯一） | 1.25rem～1.5rem | 600 |
| **H2** | 區塊標題（卡片標、表單區標） | 1rem～1.125rem | 600 |
| **H3** | 小節、列表標題、表格表頭 | 0.875rem | 600 |
| **Body** | 內文、表格內容、表單輸入 | 0.875rem～1rem | 400 |
| **Caption** | 側欄項目、輔助說明、日期、標籤 | 0.75rem～0.875rem | 400～500 |

- **行高**：內文 ≥ 1.5；表單/表格可 1.4～1.5。**最小字級不低於 12px**。
- **文字色**：主要 Carbon Black；次要 Carbon Black 80% 或中性灰。

---

## 四、元件與互動

- **按鈕**：主要 Bright Teal Blue 底白字；次要白底 Carbon Black 邊框與文字；危險 Berry Crush 底（小面積）或白底 Berry Crush 邊框/文字。
- **卡片/區塊**：白底或 Porcelain、邊框 Carbon Black 極淺或 Jungle Green 極淺（1px）；圓角統一（約 0.5rem～0.75rem）。標題 H2。
- **表格**：表頭 Carbon Black 淺底或白底 Carbon Black 字；隔行可 Jungle Green 極淡或 Porcelain；邊框 Carbon Black 淡色。
- **表單**：輸入框白底、Carbon Black 邊框；focus Bright Teal Blue ring；錯誤/必填提示 Berry Crush 小字或邊框。
- **標籤/狀態**：成功/完成 Jungle Green；進行中 Bright Teal Blue；警告/折扣 Berry Crush；中性 Carbon Black 淺底。僅文字與細邊，無 emoji。
- **導覽**：側欄與頂欄僅文字與圖示（若有）；無 emoji。

---

## 五、語言與文案

- **介面以中文為主**：按鈕、標籤、表頭、導覽、提示、錯誤訊息、表單 placeholder 等，一律使用繁體中文。
- **非必要不展示英文**：僅在技術必要時使用英文（如專有名詞、品牌名、API 回傳代碼、開發用 traceId 等）。
- **不混用**：同一區塊內避免中英交雜；若需保留英文則以括號或副標方式處理。

---

## 六、產品情境對照

本框架涵蓋之頁型（依規格）：

- **POS**：側欄（收銀、訂單、促銷、報表、後台）、主區白底、列表/結帳區緊湊。
- **後台 Admin**：側欄（總覽、庫存、商品、倉庫門市、分類、金流報表、促銷、客戶匯入、Loyalty 等）；主區白卡、表單、表格。
- **Loyalty**：儀表板、點數存摺、會員管理、優惠券、系統設定；狀態以 Jungle Green / Bright Teal Blue / Berry Crush 區分。

---

## 七、獨立 Mockup

可點可捲的靜態 HTML mockup 位於 [docs/mockup/](mockup/)：**後台** `index.html`（總覽）、`list.html`（會員管理）、`form.html`（新增會員）；**POS** `pos.html`（收銀）、`pos-orders.html`（訂單）、`pos-promos.html`（促銷）、`pos-reports.html`（報表）。側欄連結切換，後台與 POS 可互連，樣式依本文件。**前端實作與修改**須依 [frontend-ui-principles.md](frontend-ui-principles.md) 之原則與方向。
