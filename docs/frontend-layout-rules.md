# 前端版面規則（INSTRUCTIONS 023）

> 依 UI-UX-AUDIT-AND-OPTIMIZATION.md 訂定，全站逐步套用。

## max-width 收斂

| 類型 | max-width | 適用頁面 |
|------|-----------|----------|
| 列表／報表類 | `max-w-6xl` | 金流報表、應收應付、採購單、進貨驗收、補貨、會員列表、分群、發券規則、促銷、商品、庫存、訂單查詢、業績報表、客戶 CSV 匯入、Job 監控、穿透點擊審計 |
| 總覽／儀表板 | `max-w-6xl` 或 `max-w-7xl` | 營運總覽、倉庫/門市 |
| 表單／設定類 | `max-w-2xl`～`max-w-4xl` | Loyalty 設定、表單編輯、Modal 內表單 |

## 邊框與文字

- 卡片邊框：`border-brand-surface`（等同 #e2e8f0）
- 標題／內文：`text-content`（#1e293b）
- 說明／標籤：`text-muted`（#64748b）
- 移除 `ring-neutral-100` 等重複語意

## 空狀態／錯誤／載入

- 空狀態：`EmptyState` 元件（message + 可選 description）
- 錯誤：`Alert variant="error"`
- 載入：統一「載入中…」或 skeleton 結構
