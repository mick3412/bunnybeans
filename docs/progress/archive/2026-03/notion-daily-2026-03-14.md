# POS ERP｜開發日報 2026-03-14（整合版）

> **用途**：複製下方 **今日完成／卡點／To Do** 貼入 Notion。  
> **整合**：本日後端進度檔 + **促銷功能開發計畫** Agent 實作紀錄 + POS／Dashboard／報表殼。

---

## Notion 建議屬性

| 屬性 | 建議值 |
|------|--------|
| **日期** | 2026-03-14 |
| **狀態** | 已彙整（含促銷模組） |
| **最後更新** | 依實際寫入 |

---

## 今日完成

### 後端

- **延續 03-13 主線**：**jest 16 passed**；**GET /finance/events**（**preset=last30d**）；**GET /categories/enriched**；**GET /inventory/events/export**（CSV，Admin Key）；**e2e.yml** backend-test → playwright。
- **促銷功能開發計畫（Agent）**  
  - **Prisma**：`PromotionRule`、`Customer.memberLevel`、`PosOrder` 折讓欄位；migration **`20260314180000_promotion_rules_pos_discount`**。  
  - **PromotionEngine** + 單元測試（條件／行動／階梯／排他／首購／會員等）。  
  - **API**：**GET/POST/PATCH/DELETE /promotion-rules**、reorder；Admin Key 保護寫入。  
  - **POS 建單**：折讓試算、`totalAmount` 與付款一致。  
  - **Seed**：範例規則（如「全館滿千折百」）。  
- **其他**：**GET /admin/dashboard/summary**；**GET /pos/reports/summary**（若本 branch 已併入）。

### 前端

- **POS 整體殼**：**PosLayout**（Register／Orders／Promos／Reports／Settings→後台）；巢狀路由；側欄 **SVG**、固定高度。  
- **售價**：商品列表／建單接 **`salePrice`**（不再寫死 100）；seed 商品 A 對齊。  
- **POS 報表頁**：四卡（Total Revenue、Orders、Avg Order、Refunds）接 **`/pos/reports/summary`**。  
- **促銷後台**：**AdminPromotionsPage**、**AdminPromotionEditPage**（列表／編輯／預覽；整卡進編輯、刪除獨立）。  
- **Promos 占位／對齊設計**：SAVE10、FLAT2、HAPPY20、BIG5 等 mock 文案（與設計稿一致者可再接真 API）。  
- **後台**：Forge **Dashboard** + **AdminLayout** 深側欄。  
- **錯誤碼**：**POS_STORE_NO_WAREHOUSE** 單一文案（結帳／退貨入庫）。  

### 文件與進度

- **integrated-progress-2026-03-14.md**（本日整合報告，含促銷 Agent 摘要）。  
- **backend-progress-2026-03-14.md**、**AGENT-DEV-INSTRUCTIONS.md**（§1 補 POS 殼一句）。  
- **deploy-preview.md**：Tunnel、**VITE_API_BASE_URL**、促銷 API **404** 疑難（舊後端／未 migrate）。

---

## 卡點

| 項目 | 說明 |
|------|------|
| **Cannot GET /promotion-rules** | 回應的後端**非**含 PromotionModule 之版本 → **關掉舊 3003、migrate deploy、重啟新 build**。 |
| **EADDRINUSE :3003** | 與 E2E／新 API 相同；僅保留一個後端實例。 |

---

## To Do

| 優先 | 項目 |
|------|------|
| P1 | 正式環境 **migrate deploy** + **seed**；確認 **VITE_API_BASE_URL** 指向正確 API。 |
| P2 | 前端報表 MVP 續串 **finance/events**、可選 **categories/enriched**；POS 結帳與 **promotion preview** 若未接滿則列下一 sprint。 |
| P3 | CI Playwright 全綠；可選 ADMIN_KEY 後台 E2E。 |

---

## 相關 Repo 路徑（本歸檔夾內；與當日檔名對照）

- 整合報告：[integrated-progress-2026-03-14.md](integrated-progress-2026-03-14.md)
- 後端進度：[backend-progress-2026-03-14.md](backend-progress-2026-03-14.md)
- 前端進度：[frontend-progress-pos-2026-03-14.md](frontend-progress-pos-2026-03-14.md)
- Agent 指令：`docs/AGENT-DEV-INSTRUCTIONS.md` · 現行協作：`docs/agent-collab/`
