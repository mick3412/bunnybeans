## 今日進度快照（2026-03-14）

> **最後彙整**：2026-03-14 **19:00**—Square-tone 與 POS／後台側欄體驗；入庫調撥對齊；訂單表頭／按鈕換行；門市下拉依後端 merchantId

| 項目 | 內容 |
|------|------|
| **今日完成** | **Square-tone**：`docs/ui-palette-square-tone.md`、`.cursor/rules/ui-palette-square.mdc`；**Button** 主色 `#006AFF`、成功綠、次按鈕白底灰框、`rounded-lg`。**AdminLayout** 主區 `#F5F5F5`、側欄選中藍。**商品表單**側欄改白卡／neutral，分組小標與重量 hint（延續 03-13 版面計畫）。**PosLayout** 導覽 **SVG** 取代 emoji；側欄 **`h-screen` + `sticky`**，**後台**鈕固定於視窗底、不必捲整頁。**AdminLayout** 側欄同樣 **固定一屏高**，**回 POS** 常駐。**入庫／盤點 + 倉庫調撥** 寬屏 **2×2 grid**，兩張表單卡片頂緣對齊；調撥卡改白底與左卡一致。**PosOrdersListPage** 表頭 **置中**；**查看明細** `whitespace-nowrap`、操作欄加寬、`min-w-[680px]`。掛帳／門市：**後端** `listStores` 帶 `merchantId`、掛帳可 **phone/email** 解析後，前端 **PosCheckoutModal** 已放寬驗證（對話與後端對齊）。 |
| **卡點** | 無。 |
| **To Do** | 促銷／報表等新路由若上線，補 E2E；`migrate deploy` 後全站回歸。 |

---

## 目前完成的前端工作（摘要）

- 路由與 POS／後台主流程維持 03-13 摘要（登入、收銀、訂單、明細、退貨入庫、E2E×6、報表 MVP、toast、分類等）。
- **本日新增**：全域主按鈕與後台主視覺收斂至 Square-tone；POS 左欄圖示與**後台／POS 切換**不需捲動；後台**入庫／調撥**雙卡對齊；訂單列表表頭與操作欄可讀性。

## 需要後端配合的事項

- **已滿足（本日對齊）**：**GET /stores** 含 **`merchantId`**（倉庫門市下拉）；掛帳 **customerPhone**／**customerEmail**（**POST /pos/orders** body）；錯誤碼 **POS_CREDIT_CUSTOMER_***。
- **進行中**：促銷／POS 報表等若仍 WIP，以前端接好 API 與型別後再勾完成。

## 前端下一步 TODO

- 促銷 UI 與後端 Promo API 聯調；Named Tunnel／預覽環境變數說明延續 **deploy-preview.md**。

## 本日變更紀錄 （僅追加）

- **19:00 更新**（對齊 **docs/progress/README** 前端進度格式）：新建本檔 **frontend-progress-pos-2026-03-14.md**；上方快照＋摘要＋本區僅追加；與 **notion-daily-2026-03-14**、README 前端列同步。
- **15:30 更新**（Square-tone）：`Button.tsx` primary `#006AFF`／success `#28A745`／secondary 白底灰框；`AdminLayout` 背景與導覽 active 藍；`AdminProductsPage` 側欄去 violet；`docs/ui-palette-square-tone.md`、`ui-palette-square.mdc`。
- **16:00 更新**（PosLayout）：emoji → SVG（收銀／訂單／促銷／報表／後台）；側欄 `sticky top-0 h-screen max-h-screen overflow-hidden`；nav `min-h-0 flex-1 overflow-y-auto`；底部後台 `shrink-0`。
- **16:15 更新**（AdminLayout）：側欄同 POS 固定一屏高；nav 可捲；**回 POS** `shrink-0`。
- **16:40 更新**（AdminInventoryAdjustPage）：lg **2×2 grid**（標題列／表單列）對齊雙卡；調撥表單改白卡；狀態色綠／紅對照 Square 文件。
- **17:00 更新**（PosOrdersListPage）：`thead` **text-center**；操作欄 **whitespace-nowrap**、`w-24`、表 `min-w-[680px]`。
- **17:20 更新**（商品表單）：延續 03-13 計畫—分組、重量 hint、價格兩欄（見 **AdminProductsPage** 當前版）。
- **字體字階**：[ui-typography.md](../../ui-typography.md) T1～T5；`styles.css` `--font-sans`（繁中堆疊）、body 15px／antialiased；Layout 頂欄 **text-xl**、POS 側欄 **11px+**、寬 **5rem**；Button sm **text-xs**。
- **側欄／中文／色票**：POS 側欄全中文（收銀、訂單、促銷、報表、後台），與後台同 **neutral-950**／底欄 **Button**；後台側欄「總覽」、頂欄「總覽」、**回收銀**；各頁去除與頂欄重複 **h1**；新增 **[ui-color-inventory.md](../../ui-color-inventory.md)**、規則連結盤點表。
- **TASK P1～P3**：新增 **`.github/workflows/backend-ci.yml`**、**`e2e.yml`**（Postgres → push → seed → jest；Playwright job 設 **CI=1**、**VITE_API_BASE_URL**、**VITE_ADMIN_API_KEY**＝`secrets.ADMIN_API_KEY`）。**AdminReportsPage** 自訂 **from/to**。**AdminProductsPage／AdminPromotionsPage** 寫入 **showToast**。**AdminDashboardPage** 呼叫 **GET /categories/enriched** 提示列。**PosPromosPage** 改 **listPromotionRules(active)** + **getStores.merchantId**。**PosPage** 側欄 UUID → **previewPromotions.customerId**。**PosOrderDetailPage** 顯示 **subtotalAmount／discountAmount／promotionApplied**。**StoreDto** 補 **merchantId**。**TASK-frontend-agent-plan-integrated.md** 文末精簡版對齊 P1～P3。
