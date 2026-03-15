# 後端本輪 — 先做這些（規格 Agent 只改「§1」）

**協作**：[@docs/agent-collab](../agent-collab/AGENT-COLLABORATION.md) · 完成後追加 **agent-log-backend**（HH:MM）。

### 常駐指令（測試資料）— 規格 Agent **勿刪**

若在 **jest／整合測試／手動 API／腳本** 中**新增寫入 DB 的測試用資料**（非既有 seed 劇本之一）：**測試流程結束後（無論通過或失敗）必須刪除該批資料**（`afterEach`／`afterAll`／`teardown`／手動 DELETE 或 **rollback 交易**）。避免殘留列影響他人與下一輪 CI。**例外**：刻意要留作 fixture 的，須在 spec 註明並用固定前綴／單號，且與 **db:seed** 劇本不衝突。

---

## 0. 順序

| 項目 | 說明 |
|------|------|
| **有 DB** | `migrate deploy` → **`pnpm db:seed`**（會清空業務表，見 [db-seed.md](../db-seed.md)）→ 再跑 **jest**。 |
| **契約** | 改 API 先改 **api-design-***（Loyalty：[api-design-loyalty.md](../api-design-loyalty.md)；採購：[api-design-purchase.md](../api-design-purchase.md)）。 |

---

## 1. 本輪必做（迴歸 + SEED 可重現）

1. **迴歸**：`pnpm --filter pos-erp-backend test` 全綠；**purchase.integration-spec** teardown 清乾淨。

2. **SEED 可執行（有 DB 時）**：`migrate deploy` 後 **`pnpm db:seed`** 成功無錯；**[db-seed.md](../db-seed.md)** 多會員／多 POS／PointLedger 對照與實際 DB 一致（至少 **PosOrder ≥ 10**、**Customer** 含 **MEM004** 零訂單列）。

3. **docs/agent-collab/agent-log-backend.md**（**HH:MM** + jest 基線／seed 是否已跑）。

**選配（本輪可不做）**

- **Loyalty integration-spec**：**GET dashboard**、**GET point-ledger?merchantId=** 200（可 mock 或 test DB）。  
- **採購 §5.1** **RETURN_TO_SUPPLIER**／**PURCHASE_RETURN**（先改 **api-design-purchase**）。  
- 結帳 **BURNED** 寫入 PointLedger（若產品要閉環折抵）。

---

## 2. 驗收

- [ ] jest 全綠 + purchase spec 符合上項。  
- [ ] （有 DB）seed 一輪成功或 agent-log 註明未跑 DB 原因。  
- [ ] agent-log 有本輪 **HH:MM** 條目。

---

## 3. 禁止

整份重寫本檔（規格 Agent 僅覆寫 §1 清單即可）；繞過 InventoryEvent 做入庫；測試新增資料不清理（違反上方**常駐指令**）。

---

## 4. 固定參考

| Loyalty 合約 | [api-design-loyalty.md](../api-design-loyalty.md) · [crm-loyalty-ui-plan.md](../crm-loyalty-ui-plan.md) |
| 採購等 | [api-design-purchase.md](../api-design-purchase.md) · [API-DECISIONS-bulk.md](../API-DECISIONS-bulk.md) |
| Seed | [db-seed.md](../db-seed.md) |
| 守則 | [AGENT-RULES.md](../AGENT-RULES.md) · [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md) |
