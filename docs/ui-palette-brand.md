# POS 專案 UI 品牌色盤（四色）

本文件為**品牌色**依據；**全站殼層**（深側欄、淺灰主區）見 [ui-forge-shell.md](./ui-forge-shell.md)。實作以 [`frontend/src/styles.css`](../frontend/src/styles.css) `@theme` 為準。

---

## 色票與語意

| 色碼 | 變數 / Tailwind | 用途 |
|------|-----------------|------|
| **#FFF4EA** | `--color-brand-canvas` / `bg-brand-canvas` | 全站主背景、主內容區底 |
| **#EDDCC6** | `--color-brand-surface` / `bg-brand-surface`、`border-brand-surface` | 次背景、表頭、邊框、側欄 hover 輔助 |
| **#7EACB5** | `--color-brand-primary` / `bg-brand-primary`、`text-brand-primary` | **主 CTA**、連結、Nav 選中、focus ring |
| **#6B9BA5** | `--color-brand-primary-hover` / `hover:bg-brand-primary-hover` | 主色 hover |
| **#BF4646** | `--color-brand-danger` / `bg-brand-danger` | 刪除、錯誤、destructive（小面積，勿大底） |
| **#A63D3D** | `--color-brand-danger-hover` | 危險鈕 hover |

文案維持 **neutral-900／slate** 深灰黑，確保米色底上可讀。

---

## 元件對照

- **Button primary／success**：`brand-primary` + 白字。
- **Button secondary**：白底 + `border-brand-surface` + hover `bg-brand-canvas`。
- **POS／後台側欄選中**：`bg-brand-primary`。
- **錯誤區塊**：可用 `brand-danger`/10～15% 底 + 深紅字。

---

全站現用色分類盤點（含硬編碼 hex）：[ui-color-inventory.md](./ui-color-inventory.md)。  
字階與字型：[ui-typography.md](./ui-typography.md)。

## 檢查

- [ ] 新畫面勿再使用舊 Square 藍 `#006AFF`。
- [ ] 大面積背景僅 **canvas** 或白卡；**surface** 用於區隔與邊框。
- [ ] 主互動僅 **一系主色（青綠）**；紅僅危險語意。
