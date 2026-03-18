---
title: 客戶端超級管理員使用手冊
audience: 客戶端超級管理員（全權限，不含部署）
build:
  generatedAt: "{{GENERATED_AT}}"
  gitSha: "{{GIT_SHA}}"
---

## 快速開始（10 分鐘）

這份手冊是給「**客戶端超級管理員**」使用：你能做所有後台設定與操作，但**不包含部署/維運**。

### 你最常做的 5 件事

1. 建立商品（含條碼/規格/標籤）
2. 匯入/管理會員（含分群/等級規則）
3. 建立促銷並在 POS 驗證
4. 盤點/調整庫存
5. 看報表、匯出資料

### 本手冊版本

- **產出時間**：`{{GENERATED_AT}}`
- **對應版本**：`{{GIT_SHA}}`

---

## 如何重新產生最新版（給內部或超管）

在 repo 根目錄執行：

```bash
pnpm manual:build
```

輸出位置：

- **Markdown**：`docs/manual/`（本目錄）
- **PDF**：`docs/manual/dist/manual.pdf`

---

## 導覽（依任務找流程）

- [01 登入與權限](01-login-and-permissions.md)
- [02 商家與門市設定](02-merchant-and-stores.md)
- [03 商品與條碼/標籤](03-products.md)
- [04 會員與 CRM（分群/等級/聯絡紀錄）](04-customers-crm.md)
- [05 促銷（規則、POS 驗證）](05-promotions.md)
- [06 庫存（查詢/調整/批號效期）](06-inventory.md)
- [07 採購與驗收](07-purchase-and-receiving.md)
- [08 POS 訂單（開單/付款/退款作廢）](08-pos-orders.md)
- [09 報表與稽核](09-reports-and-audit.md)
- [10 常見問題與排錯](10-troubleshooting.md)
- [附錄（門市維運 / 支援）](appendix/README.md)

---

## 圖示規範（讀圖不讀文字）

我們用「**一張圖對一段步驟**」的方式寫：

- 截圖檔放在 `docs/manual/assets/`
- 檔名格式：`<章節>_<任務>_<序號>.png`（例：`03_products_create_01.png`）
- 圖上標註規則：
  - 圓形數字：步驟 1/2/3
  - 紅框：要點的按鈕/欄位
  - 每張圖最多 3 個標註（太多就分圖）

