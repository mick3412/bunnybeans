# 已開發／開發中模組 — 優化方向（參考）

供規格 Agent 與 INSTRUCTIONS 對齊；不必每輪全文複製，可連結本檔。

| 模組 | 現況 | 優化方向 |
|------|------|----------|
| **採購／供應商／驗收** | API + UI 已有；seed 未含採購資料 | **Seed**：Supplier + 多狀態 PO + 1～2 張 RN，利手測。**整合測試**：submit → receiving complete → 餘額 + PURCHASE_IN。**Phase 2**：驗收 complete 後 **PURCHASE_PAYABLE**（與 api-design §5）。**取消規則**：DRAFT/ORDERED 可否 cancel 寫進 api-design。 |
| **批量匯入／匯出** | CSV、async job、客戶 preview/apply | **觀測**：job **failed** + **error** 前後端一致（已有 §6.6）。**限流**：POST imports/jobs 文件化或簡單 rate limit。**大檔**：超時與進度若產品要再做。 |
| **庫存／盤點** | events、balances、CSV import | **匯出**：與篩選條件一致。**盤點**：重複 referenceId 防呆（若尚未）。 |
| **POS／訂單** | 結帳、列表、CSV export | **離線／重試**（若需要）。**促銷**：規則複雜度與效能。 |
| **金流報表** | FinanceEvent list/export | **採購應付**接上後報表維度補一欄 type。 |
| **Admin 體驗** | 多頁、部分需 Key | **統一錯誤 toast**、**401 引導**。**側欄**：採購區已掛則確認路由活躍狀態。 |
| **基礎建設** | 無 DB 時曾跳過 migrate | **有 DB 時**：migrate deploy、seed、Guard／ADMIN_KEY、CI e2e 一鍵綠。 |

---

## 開發中 vs 已交付

- **已交付（可優化）**：商品／庫存 CSV、客戶 preview/apply、POS export、採購 CRUD + 驗收 complete。
- **開發中／待閉環**：採購 **seed + 整合測試 + 應付帳**；前後端 **真 API 聯調預設**。
