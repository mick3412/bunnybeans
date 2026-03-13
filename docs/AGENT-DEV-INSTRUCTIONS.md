# 後端／前端開發指令（給 Agent 與 Owner）

> 與後端進度對齊：**2026-03-13**（Brand、`GET /brands`、賒帳 `allowCredit`、`SALE_PAYMENT`、明細 `paidAmount`／`remainingAmount`／`credit`）  
> 進度入口：`docs/progress/README.md` → 最新整合報告與各端進度檔。

---

## 現況速覽

| 後端已完成 | 前端仍待做 |
|------------|------------|
| POS 全額／賒帳建單、`payments`、`paidAmount`、`remainingAmount`、`credit` | 結帳送 `allowCredit`+`customerId`+部分 payments；明細顯示未收／掛帳 |
| `GET /brands`、`GET /products?brandId=`、`tag`、商品 `brandId`/`tags` | 品牌列與 API 連動 |
| `POS_CREDIT_REQUIRES_CUSTOMER` 等錯誤碼 | `ERROR_CODE_MAP` 補齊 |
| 補款 API | —（後端可排程） |

---

## 一、後端 Agent — 開發計畫 + 複製貼上指令

### 計畫（建議）

1. **補款／沖帳**（若本輪要做）：新 endpoint 或擴充 POS，對既有賒帳單寫入額外 `SALE_PAYMENT`、更新可讀餘額；先改 `api-design-pos.md` 再實作。
2. **維運**：新環境 `prisma migrate` 或 `db push` + `db:seed`（含 Brand／多商品）。
3. **可選**：全端 E2E；CORS 若 Vercel + Tunnel 需再檢查。

### 複製貼上（給後端 Agent）

```
你是本專案後端 Agent（NestJS、Prisma、PostgreSQL）。

【必讀】
docs/progress/README.md → integrated-progress-2026-03-13.md → backend-progress-2026-03-13.md
docs/collaboration-rules-backend-frontend.md
docs/api-design-pos.md、docs/api-design-inventory-finance.md、docs/api-design.md（§6 brands/products）
docs/backend-error-format.md

【現況】
POS 已支援 allowCredit + customerId、部分付款 payments、SALE_PAYMENT、明細 paidAmount/remainingAmount/credit。
GET /brands、GET /products?brandId=&tag= 已上線；Seed 含品牌與標籤。

【本輪可選任務】
A. 補款 API：對既有賒帳單再收一筆（文件 → 實作 → 錯誤碼 → 測試）。
B. 維持 stable、修 bug、補整合測試。
C. E2E 或部署文件更新。

【完成後】
更新 docs/progress/backend/backend-progress-YYYY-MM-DD.md（本日變更只追加）、docs/progress/README.md 最後更新。
```

---

## 二、前端 Agent — 開發計畫 + 複製貼上指令

### 計畫（建議順序）

1. **P0 賒帳結帳**：讀 `docs/api-design-pos.md` 的 `CreatePosOrderRequest`（`allowCredit`、`customerId`、`payments` 總和 ≤ 應收）。結帳 Modal：客戶 ID 輸入或選擇、勾選掛帳時送 `allowCredit: true`、`payments` 依實收拆列（可單筆 CASH 金額 &lt; 應收）。
2. **P0 明細**：顯示 `paidAmount`、`remainingAmount`、`credit`；與既有實收／收款方式並列。
3. **P1 品牌**：`GET /brands` 填第二列；`GET /products?brandId=`（與 category 並存時依 UX 決定是否同時傳兩個 query）。
4. **ERROR_CODE_MAP**：補 `POS_CREDIT_REQUIRES_CUSTOMER`、`POS_PAYMENT_EXCEEDS_TOTAL`、`POS_PAYMENT_AMOUNT_INVALID`（文案對照 backend-error-format.md）。
5. **可選**：`tag` 折扣列；E2E。

### 複製貼上（給前端 Agent）

```
你是本專案前端 Agent（React、Vite、TypeScript、Tailwind）。

【必讀】
docs/progress/README.md → integrated-progress-2026-03-13.md → frontend-progress-pos-2026-03-13.md
docs/collaboration-rules-backend-frontend.md
docs/api-design-pos.md（CreatePosOrderRequest、PosOrderDetail 含 paidAmount、remainingAmount、credit）
docs/backend-error-format.md（賒帳相關 code）

【現況】
後端已支援賒帳建單與 GET /brands；前端仍為全額結帳與 mock 品牌列。

【本輪任務（建議順序）】
1. 結帳：allowCredit + customerId（必填於掛帳時）；payments 加總 ≤ 應收；允許實收 < 應收。
2. posOrdersApi / 型別：CreatePosOrderRequest、PosOrderDetail 對齊文件。
3. 訂單明細頁：paidAmount、remainingAmount、credit 顯示。
4. GET /brands + 品牌篩選 + GET /products?brandId=。
5. ERROR_CODE_MAP 補 POS_CREDIT_REQUIRES_CUSTOMER、POS_PAYMENT_EXCEEDS_TOTAL、POS_PAYMENT_AMOUNT_INVALID。

【完成後】
更新 docs/progress/frontend/frontend-progress-pos-YYYY-MM-DD.md（本日變更只追加）、docs/progress/README.md 最後更新。
```

---

## 三、依賴關係

- 前端賒帳與品牌**可並行開發**，均以 **api-design-pos.md** 為準。  
- 補款 UI 需待後端補款 API 定案後再接。

---

## 四、路徑索引

| 檔案 | 用途 |
|------|------|
| `docs/progress/integrated-progress-2026-03-13.md` | 整合表與任務清單 |
| `docs/AGENT-DEV-INSTRUCTIONS.md` | 本檔 |
| `docs/api-design-pos.md` | POS 合約（賒帳、明細欄位） |
