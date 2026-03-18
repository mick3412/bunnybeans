# POS/CRM/ERP 靜態 Mockup

可點可捲的 HTML 示意，介面以中文為主，無 emoji。**全站採用「儀表板／數據感」為預設風格**（深色側欄、KPI 藍／綠／橙／灰區分、表格邊框極細、多區塊與懸浮表頭）。

**預設色系**：主區 #f1f5f9、側欄 #1e293b、主色 #0ea5e9、KPI 左色條區分。多區塊、雙欄版面、懸浮表格（sticky 表頭）、底部懸浮操作列已套用於各頁。

**前端修改依據**：進行 UI 修改時請依 [../frontend-ui-principles.md](../frontend-ui-principles.md) 之原則與方向；主畫面區排版可依規格與需求調整。

## 如何開啟

用瀏覽器直接開啟任一 HTML 即可（不需伺服器）：

```bash
open docs/mockup/index.html
# 或 open docs/mockup/pos.html
```

## 後台

| 檔案 | 說明 |
|------|------|
| [index.html](index.html) | 總覽：KPI 四卡、雙欄（最近點數異動表 + 進行中促銷卡 + 本日摘要） |
| [list.html](list.html) | 會員管理：摘要區塊、篩選列、懸浮表頭會員表、底部懸浮列 |
| [form.html](form.html) | 新增會員：雙欄（基本／進階表單 + 填寫說明 + 快速統計卡） |

側欄有「前往 POS」可切到 POS 收銀。

## POS

| 檔案 | 說明 |
|------|------|
| [pos.html](pos.html) | 收銀：會員欄、可套用促銷區、商品區、購物車、本筆提示卡 |
| [pos-orders.html](pos-orders.html) | 訂單：本日摘要 KPI、篩選列、懸浮表頭訂單表、底部匯出列 |
| [pos-promos.html](pos-promos.html) | 促銷：促銷摘要 KPI、進行中表（sticky）、已結束區塊 |
| [pos-reports.html](pos-reports.html) | 報表：銷售 KPI、雙欄（圖表佔位 + 近 7 日比較卡）、訂單表、底部匯出列 |

POS 側欄有「後台」可回到後台總覽。點數存摺、系統設定、金流報表為占位。

## 風格變體

同一結構可切換不同視覺，側欄均有「預設風格」可回到本目錄。

| 風格 | 入口 | 說明 |
|------|------|------|
| **Square POS** | [square/index.html](square/index.html)、[square/pos.html](square/pos.html) | 淺灰底、白側欄、主色藍 #006AFF。見 [square/README.md](square/README.md)。 |
| **極簡／留白** | [minimal/index.html](minimal/index.html)、[minimal/pos.html](minimal/pos.html) | 大量白與極淺灰、單一主色（黑）、間距大。見 [minimal/README.md](minimal/README.md)。 |
| **暖色／在地感** | [warm/index.html](warm/index.html)、[warm/pos.html](warm/pos.html) | 米色底、暖棕主色、深綠成功；適合餐飲／選物。見 [warm/README.md](warm/README.md)。 |
| **儀表板／數據感** | 根目錄全站已採用 | 即本目錄預設風格；[dashboard/](dashboard/) 為獨立副本可對照。 |

---

## 其他建議風格

若想再擴充 mockup 變體，可考慮以下方向（已實作：Square、極簡、暖色、儀表板／數據感；其餘可比照做覆寫或新增子資料夾）：

| 風格 | 特色與色感 | 適用情境 |
|------|------------|----------|
| **深色／夜間模式** | 主背景與側欄深灰或黑（#1a1a1a）、主內容區略亮；主色保留一組亮色（藍或青）做 CTA；文字淺灰／白。 | 長時間操作、店內光線較暗、或與品牌「夜間」形象一致。 |
| **高對比無障礙** | 背景與文字對比 ≥ 4.5:1；主色飽和但不過亮；按鈕與連結有明顯邊框或底；字級與點擊區略大。 | 無障礙規範、公共場所 kiosk、或高齡／視力友善需求。 |

實作方式：複製 `mockup-square.css` 為 `mockup-{風格名}.css`，改寫 `:root` 與側欄／按鈕等覆寫，再新增一層子資料夾（如 `dark/`、`minimal/`）載入該 CSS 即可與現有、Square 並存對照。
