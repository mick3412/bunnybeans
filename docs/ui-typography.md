# 全站字體與字階（Typography）

> 與 [ui-palette-brand.md](./ui-palette-brand.md) 並列；新畫面請優先對照本表，避免同頁混用過多字級。

## 字型堆疊（CSS）

全站 `--font-sans`（見 `frontend/src/styles.css`）：

- **西文**：`ui-sans-serif`, `system-ui`, `Segoe UI`
- **中文**：`PingFang TC`（macOS）、`Microsoft JhengHei`（Windows）、`Noto Sans TC`（若系統有裝）
- **後備**：`sans-serif`

`body`：`antialiased`、預設 **15px**、`line-height: 1.5`，利於長文與表單。

---

## 字階分類（T1～T5）

| 代碼 | 用途 | Tailwind 建議 | 字重 | 備註 |
|------|------|---------------|------|------|
| **T1** | 後台頂欄標題、少數單頁大標 | `text-xl font-semibold tracking-tight` | 600 | 全站唯一「頁名」層級（Layout `h1`） |
| **T2** | 區塊標題、表單組標題 | `text-base font-semibold` | 600 | 卡片內小節 |
| **T3** | 內文、表格內容、按鈕 md | `text-sm` | 400–500 | 預設閱讀層 |
| **T4** | 側欄導覽、次要說明、標籤 | `text-sm font-medium`（側欄）／`text-xs`（說明） | 500／400 | 後台側欄連結 = T3 sm |
| **T5** | 極小標（POS 窄欄）、輔助、日期 | `text-xs` | 500–600 | 勿小於 11px（易讀） |

---

## 優化原則

1. **單頁一個 T1**：已由 Layout 承擔時，內容區勿再堆疊第二個同級大標。
2. **字重**：標題 `semibold`；內文 `normal`；按鈕 `semibold`（已於 Button）。
3. **行高**：說明段落可用 `leading-relaxed`；表格／表單維持預設或 `leading-snug`。
4. **窄欄（POS 側欄）**：至少 `text-xs`（12px），避免 10px 長期閱讀疲勞。

---

## 元件對照

| 元件 | 字階 |
|------|------|
| AdminLayout 頂欄 `h1` | T1 |
| AdminLayout 日期 | T5 |
| Admin 側欄 NavLink | T3 + medium |
| POS 側欄標 + Nav | T5（標）+ T5／xs（連結） |
| Button `md` | T3 + semibold |
| Button `sm` | T5 + semibold |
| 頁首說明段落 | T4 `text-sm text-neutral-600` |
