# 前後端整合進度與開發紀錄 2026-03-14

> 整合來源：**本日 repo 變更**、[`notion-daily-2026-03-14.md`](notion-daily-2026-03-14.md)、[`backend-progress-2026-03-14.md`](backend/backend-progress-2026-03-14.md)、以及 **促銷功能開發計畫** Agent 對話紀錄（計畫檔名：`促銷功能開發計畫_760b1b38`）之實作與驗證。  
> **前一日**：[`integrated-progress-2026-03-13.md`](integrated-progress-2026-03-13.md)

---

## 一、今日一句摘要

後端延續 **jest 16**、**finance / categories enriched / 庫存 CSV / e2e workflow**；**促銷模組**（`PromotionRule`、引擎、**GET/POST…/promotion-rules**、POS 折讓與 migration）與**後台促銷列表／編輯**、seed 範例規則已落地。前端 **POS 整體殼**（Register／Orders／Promos／Reports／Settings）、**售價接 salePrice**、**GET /pos/reports/summary** 四卡、**Forge 後台 Dashboard**、錯誤碼整理與 deploy 說明一併對齊。

---

## 二、促銷功能開發計畫（Agent 紀錄整合）

| 項目 | 狀態 | 說明 |
|------|------|------|
| **Schema** | 已落地 | `PromotionRule`（merchant、priority、draft、時間窗、exclusive、firstPurchaseOnly、memberLevels、conditions、actions JSON）；`Customer.memberLevel`；`PosOrder.subtotalAmount`、`discountAmount`、`promotionApplied`，`totalAmount` 為折後應收。 |
| **Migration** | 需 deploy | `20260314180000_promotion_rules_pos_discount`；既有訂單回填 `subtotalAmount = totalAmount`、`discountAmount = 0`。 |
| **引擎** | 已落地 | `PromotionEngine`：條件 SPEND／QTY／TAG_COMBO；行動 WHOLE_PERCENT（階梯）、WHOLE_FIXED、LINE_PERCENT 等；單元測試。 |
| **Admin API** | 已落地 | **promotion-rules** CRUD + reorder；**AdminApiKeyGuard**；文件 `api-promotion-rules.md`（若 repo 內有）。 |
| **POS** | 已落地 | 建單流程串引擎；金額與付款驗證對齊折讓後總額；可選 **POST /pos/promotions/preview**（依實作版本）。 |
| **後台 UI** | 已落地 | `/admin/promotions`、`/admin/promotions/:id` 列表／編輯／預覽；Square-tone；整卡點進編輯、刪除獨立。 |
| **POS UI** | 部分 | `/pos/promos` 曾為占位；結帳若已接 preview／折讓則以實際程式為準。 |
| **維運** | 常見坑 | **`Cannot GET /promotion-rules`** → 多為 **3003 仍跑舊後端** 或未 **migrate deploy**；需 **重啟含 PromotionModule 之 build**。 |

---

## 三、POS／後台／報表（本日與近期同一脈絡）

| 主題 | 內容 |
|------|------|
| **POS Layout** | 深側欄、SVG 導覽、**Register / Orders / Promos / Reports / Settings→Admin**；**e2e-nav-orders** 保留。 |
| **售價** | `GET /products` 之 **`salePrice`** → POS 展示與建單 **unitPrice** 一致；seed **商品 A** `salePrice: 100`。 |
| **POS 今日報表** | **GET /pos/reports/summary**（營收、單數、均單、退款）。 |
| **後台 Dashboard** | **GET /admin/dashboard/summary**（商品數、缺貨／低庫存、今日單數、庫存件數／金額）。 |
| **Forge 殼** | AdminLayout 深側欄 + 頂欄。 |
| **錯誤碼** | `POS_STORE_NO_WAREHOUSE` 合併為單一文案（結帳／退貨入庫共用）。 |

---

## 四、卡點與 To Do

| 類型 | 項目 |
|------|------|
| **卡點** | 促銷／新 API **404** → 幾乎皆為 **舊 process 佔 3003** 或未 migrate。 |
| **To Do** | 生產環境 **migrate deploy + seed**；Vercel **`VITE_API_BASE_URL`** 指新後端；前端報表可續串 **finance/events**、**categories/enriched**。 |

---

## 五、相關文件

- [AGENT-DEV-INSTRUCTIONS.md](../AGENT-DEV-INSTRUCTIONS.md)
- [api-design-pos.md](../api-design-pos.md)（含 `/pos/reports/summary`）
- [deploy-preview.md](../deploy-preview.md)
- [notion-daily-2026-03-14.md](notion-daily-2026-03-14.md)（貼 Notion 用）
- 促銷：`docs/api-promotion-rules.md`（若存在）、`backend/src/modules/promotion/`
