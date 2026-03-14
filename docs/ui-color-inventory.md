# UI 顏色盤點總表

> 用途：整站換色時對照。品牌單一來源仍為 [ui-palette-brand.md](./ui-palette-brand.md) 與 `frontend/src/styles.css` `@theme`。

---

## 一、品牌 Token（應優先使用）

| 分類 | 色碼 | 英文名 | 中文／語意 | Tailwind／CSS 變數 |
|------|------|--------|------------|-------------------|
| Brand | `#FFF4EA` | Warm off-white / Canvas | 米白・主背景 | `brand-canvas`、`--color-brand-canvas` |
| Brand | `#EDDCC6` | Tan / Surface | 淺褐・邊框／次底 | `brand-surface` |
| Brand | `#7EACB5` | Dusty teal / Primary | 灰青綠・主色 | `brand-primary` |
| Brand | `#6B9BA5` | Teal hover | 主色 hover | `brand-primary-hover` |
| Brand | `#BF4646` | Muted red / Danger | 紅・危險 | `brand-danger` |
| Brand | `#A63D3D` | Danger hover | 危險 hover | `brand-danger-hover` |

---

## 二、硬編碼 hex（與 Token 重疊或並存）

| 色碼 | 英文名 | 中文 | 與 Token 關係 | 主要出現 |
|------|--------|------|----------------|----------|
| `#7EACB5` | Same as primary | 同主色 | = brand-primary | AdminPromotionsPage、AdminPromotionEditPage、AdminProductsPage（focus／連結） |
| `#6B9BA5` | Same as primary-hover | 同主色 hover | = primary-hover | AdminPromotionEditPage（hover） |
| `#FFF4EA` | Same as canvas | 同主背景 | = brand-canvas | AdminPromotionEditPage（gradient 底） |
| `#28A745` | Bootstrap green | 成功綠 | **非** token；建議未來改 `emerald-600` 或 `--success` | AdminPromotionsPage（active badge）、AdminInventoryAdjustPage、PosPage／PosOrderDetailPage（折讓列） |
| `#E3342F` | Bright red | 亮紅・錯誤文案 | **≠** brand-danger（#BF4646）；較鮮 | AdminPromotionsPage、AdminPromotionEditPage、AdminInventoryAdjustPage |
| `#B91C1C` | Dark red | 深紅字 | Tailwind red-700 系 | AdminInventoryAdjustPage（錯誤內文） |
| `#166534` | Forest green | 深綠字 | Tailwind green-800 系 | AdminInventoryAdjustPage（成功內文） |
| `#F4F8F9` | Cool gray-blue | 冷灰藍底 | 大區背景；可收斂為 `neutral-50` 或 canvas | AdminPromotionsPage、AdminPromotionEditPage |
| `#FAFBFC` | Near white | 近白卡 | 微冷白 | AdminPromotionEditPage（卡片底） |

---

## 三、Tailwind 語意色（無固定 hex，依預設 palette）

| 分類 | Tailwind 前綴 | 英文名 | 中文／用途 | 常見場景 |
|------|----------------|--------|------------|----------|
| Neutral chrome | `neutral-*` | Neutral gray | 中性灰 | 後台側欄、文字層級、邊框 |
| Cool gray | `slate-*` | Slate | 青灰 | 多數表單、說明文字、邊框 |
| Cool gray | `zinc-*` | Zinc | 鋅灰 | Dashboard 卡片、與 slate 並存 |
| Primary accent (legacy) | `sky-*` | Sky blue | 天藍 | POS 部分按鈕／篩選（未全面改 brand） |
| Success | `emerald-*` | Emerald | 翠綠・成功 | Toast、分類成功、Dashboard 指標 |
| Danger | `red-*` | Red | 紅・錯誤底 | `red-50`／`red-200`／`red-800` 錯誤區塊 |
| Warning | `amber-*` | Amber | 琥珀・警告 | POS apiLoadError、賒帳提示 |
| Warning | `orange-*` | Orange | 橘 | PosOrderDetail 賒帳區 |

---

## 四、建議收斂（非本輪強制）

1. **`#28A745`／`#E3342F`**：逐步改為 `brand-danger` + `emerald-600`（或新增 `--color-success`）。
2. **`#F4F8F9`**：大面積改 `bg-brand-canvas` 或 `bg-neutral-50`，與全站米底一致。
3. **硬編碼 `#7EACB5`**：改 `text-brand-primary`、`border-brand-primary`、`ring-brand-primary` 等（若 Tailwind v4 已暴露）。
4. **slate vs zinc vs neutral**：後台以 **neutral** 側欄為準；內容區可統一 **slate** 或 **neutral** 擇一，減少灰階並存。

---

## 五、側欄與導覽（結構色）

| 區域 | 背景／邊框 | 說明 |
|------|------------|------|
| POS／後台側欄 | `bg-neutral-950`、`border-neutral-800` | 已對齊 |
| 側欄選中 | `bg-brand-primary`、`text-white` | 與文件一致 |
| 主內容底 | `bg-brand-canvas` | 與文件一致 |

---

*盤點日期：依 repo 現況；硬編碼以 `frontend/src/**/*.tsx` grep `#([0-9A-F]{6})` 為主。*
