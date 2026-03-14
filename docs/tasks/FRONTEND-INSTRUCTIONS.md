# 前端本輪 — 先做這些（規格 Agent 只改「§1」）

**協作**：[@docs/agent-collab](../agent-collab/AGENT-COLLABORATION.md) · 完成後追加 **agent-log-frontend**（HH:MM）。

### 常駐指令（測試資料）— 規格 Agent **勿刪**

若在 **Playwright E2E／手動後台／API 腳本** 中**新增寫入後端的資料**（例如新供應商、採購單、客戶、匯入 job）：**該次測試跑完後（無論通過或失敗）務必刪除或還原**（spec `afterEach` 呼叫刪除 API、`db:seed` 重灌、或專用 teardown）。勿把個人測試髒資料留在共用 DB。**例外**：與 seed 固定代碼一致、可重跑 seed 覆寫者，仍建議 E2E 盡量用 **seed 既有列**或 **afterAll 清理**。

---

## 0. 順序

| 項目 | 說明 |
|------|------|
| **聯調** | **VITE_API_BASE_URL**（或專案變數）指向本機 :3003；**pnpm db:seed** 後採購三頁應有列表。 |

---

## 1. 本輪必做

1. **採購迴歸**（對 seed）：**供應商 4**、**採購單多狀態**、**驗收單多狀態**；確認無 **「已核准」** Tab；**完成驗收** 一筆 IN_PROGRESS RN（手測）後庫存／列表正確。
2. **`pnpm --filter pos-erp-frontend build`** 綠。
3. **E2E（建議）**：`pnpm e2e` 或至少 **admin-smoke**／**admin-bulk**；失敗若與 **登入／路由** 有關則修斷言或 **loginAdmin**（與 **2026-03-14 20:35** log 一致）。
4. **選配**：POS 選客戶時顯示 **memberLevel**（VIP／GOLD）— 與 seed 會員對齊。
5. **docs/agent-collab/agent-log-frontend.md**（**HH:MM** + build／E2E／手測摘要）。

---

## 2. 驗收

- [ ] build 綠；採購三頁 + seed 手測無阻。
- [ ] agent-log 有本輪條目。

---

## 3. 禁止

只改 docs；拆掉採購側欄三連結；測試新增資料不清理（違反上方**常駐指令**）。

---

## 4. 固定參考

| Seed 情境 | [db-seed.md](../db-seed.md) |
| 守則 | [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md) |
