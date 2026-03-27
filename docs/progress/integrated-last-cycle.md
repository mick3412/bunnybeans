# 上一輪整合（規格 Agent 每輪覆寫）

**本輪對應 INSTRUCTIONS**：**061**（後端／前端皆已收斂並提交）  
**最新 agent-log（以 INSTRUCTIONS 編號為準）**：後端 **061** · 前端 **061**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **INSTRUCTIONS 061 主要進展**：
  - 共購分析 `GET /pos/reports/market-basket`（查詢參數、DTO、排序/門檻）收斂，integration-spec 補齊關鍵案例。
  - seed / e2e 流程補強：`full e2e:seed` 還原條碼品項庫存、`wipeAll` 註解補齊、demo 共購樣本訂單補入。
  - 財務 CSV 匯出新增 `orderNumber` 欄位（referenceId 對應 POS 訂單號）。
- **測試**：`pnpm --filter pos-erp-backend test`、`pnpm ci:backend-with-db` 皆綠（以最新 log 為準）。
- **追溯整合**：已納入 [共購分析開發實作](14f5c10d-0865-4a19-82e1-1900b5883e6b)、[退換貨系統修復補強](fb81d243-90b1-4dce-9af1-dc0dda8b5912)、[SEED 全局缺口補強](0e085e74-807a-403d-837b-a91630159665)。

## 前端（收斂摘要）

- **INSTRUCTIONS 061 主要進展**：
  - 060 收斂提交完成：訂單/退換貨整併、列表欄位調整、明細門市名稱與促銷折扣細節、成功訊息可點連結。
  - 共購分析頁完成：路由、頁面、API 串接與基本互動；新增 `e2e/pos-market-basket.spec.ts`。
  - 售後 E2E 與整併後 UX 對齊：對舊欄位場景加入條件式 skip 記錄與替代驗收說明。
- **測試**：`pnpm --filter pos-erp-frontend build` ✅；指定 Playwright 為 `4 passed / 2 skipped`（skip 已明文化）。
- **追溯整合**：已納入 [共購分析開發實作](14f5c10d-0865-4a19-82e1-1900b5883e6b)、[退換貨系統修復補強](fb81d243-90b1-4dce-9af1-dc0dda8b5912)、[SEED 全局缺口補強](0e085e74-807a-403d-837b-a91630159665)。

---

## 061 主題：共購分析落地 + 訂單/退換貨收斂 + seed 補強

| 項目 | 狀態 |
|------|------|
| 後端 Market Basket API/測試/文件 | 完成 |
| 後端 e2e seed 庫存還原與流程補強 | 完成 |
| 前端 060 收斂提交（整併/明細/文案） | 完成 |
| 前端 Market Basket 頁面與 E2E | 完成（含條件式 skip 記錄） |
| transcript 追溯整合（14f/fb81/0e08） | 完成 |

---

## 整合風險／待對齊

| 項目 | 說明 |
|------|------|
| 售後 E2E 仍有條件式 skip | 目前 skip 原因偏向「舊 UI 移除」與「列表無可操作列」，需再把 spec 改寫到新互動模型，降低長期 skip 依賴。 |
| 前端資料完整度仰賴 seed | 已補強多數空區塊，但需建立固定「seed 覆蓋檢查清單」避免後續回歸時再次空白。 |
| 文件同步節奏 | 共購分析/seed 補強已同步，後續退換貨與報表功能仍需保持「改 API 先改文件」。 |

---

## 全局審查缺口清單（061 後剩餘）

### 已收斂（061）

| 來源 | 狀態 |
|------|------|
| Market Basket 分析（API + 前端 + E2E） | 已收斂 |
| 060 前端收斂提交缺口 | 已收斂 |
| e2e seed 條碼庫存不足高頻問題 | 已緩解（仍需持續驗證） |
| 「前端頁面沒資料」主要 seed 缺口 | 已補強（見 0e transcript） |

### 待處理（建議下一輪 062）

| 來源 | 缺口 | 優先 |
|------|------|------|
| 售後 Playwright | 重寫 `pos-refund`/`pos-return-stock` 到新售後互動模型，將條件式 skip 轉為可執行斷言 | 高 |
| Seed 品質治理 | 建立可機器驗證的 seed 覆蓋檢查（報表/KPI/列表非空最小集合）與文件化清單 | 高 |
| erp-roadmap §0.1/0.2 | Product schema 深化與 ProductTag 主檔閉環後續任務（跨端） | 中 |
| 報表延伸 | 折扣 ROI、退貨原因彙總、共購分析進階指標（規則切面） | 中 |

### 中長期缺口（roadmap）

| 來源 | 缺口 | 說明 |
|------|------|------|
| erp-roadmap Phase 2+ | Party 視圖升級、補貨閉環進階、行銷活動成效 | 待排程 |
| ops-roadmap | 監控可觀測性與 click-audit 成效收斂 | 需配合真實流量檢驗 |

---

## 已開發模組進度

| 模組 | 後端 | 前端 | 備註 |
|------|------|------|------|
| Finance balances | 完成 | 完成 | 契約、roadmap、測試對齊 |
| POS 訂單/退換貨整併 | 完成 | 完成 | 061 收斂提交完成 |
| 共購分析（Market Basket） | 完成 | 完成 | API、頁面、E2E 已落地 |
| Seed 全局資料補強 | 完成 | 完成 | 仍需建立自動化覆蓋檢查 |

---

本檔為**實際進度總結**，下一輪具體任務見 [tasks/instructions/](../tasks/instructions/)（下一輪更新為 **INSTRUCTIONS 062**）§1。
