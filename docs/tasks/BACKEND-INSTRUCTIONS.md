# 後端本輪 — 先做這些（規格 Agent 只改「§1」）

**協作**：[@docs/agent-collab](../agent-collab/AGENT-COLLABORATION.md) · 完成後追加 **agent-log-backend**（HH:MM）。

### 常駐指令（測試資料）— 規格 Agent **勿刪**

若在 **jest／整合測試／手動 API／腳本** 中**新增寫入 DB 的測試用資料**（非既有 seed 劇本之一）：**測試流程結束後（無論通過或失敗）必須刪除該批資料**（`afterEach`／`afterAll`／`teardown`／手動 DELETE 或 **rollback 交易**）。避免殘留列影響他人與下一輪 CI。**例外**：刻意要留作 fixture 的，須在 spec 註明並用固定前綴／單號，且與 **db:seed** 劇本不衝突。

---

## 0. 順序

| 項目 | 說明 |
|------|------|
| **有 DB** | `migrate deploy` → **`pnpm db:seed`**（會清空業務表，見 [db-seed.md](../db-seed.md)）→ 再跑 **jest**。 |
| **契約** | 改 API 先改 **api-design-***。 |

---

## 1. 本輪必做

1. **迴歸**：`pnpm --filter pos-erp-backend test` 全綠；若 **purchase.integration-spec** 因 DB 缺表 skip，於 agent-log 註明 **passed 數與 skip 原因**。
2. **Seed 與手測一致**：必要時在 **seed.ts** 補一筆 **FinanceEvent**（對應已 COMPLETED RN 的 PURCHASE_PAYABLE）利報表 smoke—若 complete 已寫 finance 則略。
3. **選配其一**：**POST /imports/jobs** **rate limit** 一句寫入 **API-DECISIONS-bulk**；或 **RETURN_TO_SUPPLIER** 規格草案入 **api-design-purchase** §5。
4. **docs/agent-collab/agent-log-backend.md**（**HH:MM** + jest 基線／檔案）。

---

## 2. 驗收

- [x] **jest 45 passed**（本輪未跑 seed，避免清空 DB）。
- [x] agent-log **2026-03-17 11:20**（**agent-collab/agent-log-backend.md**）。

---

## 3. 禁止

整份重寫本檔；繞過 InventoryEvent 做入庫；測試新增資料不清理（違反上方**常駐指令**）。

---

## 4. 固定參考

| 合約 | [api-design-purchase.md](../api-design-purchase.md) |
| Seed | [db-seed.md](../db-seed.md) |
| 守則 | [AGENT-RULES.md](../AGENT-RULES.md) · [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md) |
