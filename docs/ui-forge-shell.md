# Forge 殼層（全站版型）

參考 Forge Dashboard／Products：深炭灰側欄、淺灰主區、白頂欄與白卡內容。

## Token（`styles.css` @theme）

| Token | 色碼 | 用途 |
|-------|------|------|
| `forge-sidebar` | `#1a1a1a` | 側欄底 |
| `forge-sidebar-active` | `#0a0a0a` | 選中導覽列底（近黑） |
| `forge-main` | `#f4f4f5` | 主內容區底、body 預設 |
| `forge-card` | `#ffffff` | 頂欄、卡片、登入卡 |

## 行為

- **選中導覽**：`bg-forge-sidebar-active` + `border-l-[3px] border-brand-primary`（左線保留品牌青綠）。
- **未選**：`text-neutral-400`，`hover:bg-white/[0.06]`。
- **後台頂欄**：白底、細邊框、搜尋框白底灰框；通知鈴 + 紅點 + 頭像。
- **總覽**：四欄指標卡 + 兩欄次要指標（大寫標、大字數、副標、趨勢色）。

品牌按鈕／CTA 仍用 **brand-primary**（與 Forge 藍條位階相同，改為既有青綠）。
