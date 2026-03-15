# 前端本輪 — 先做這些（規格 Agent 只改「§1」）

**協作**：[@docs/agent-collab](../agent-collab/AGENT-COLLABORATION.md) · 完成後追加 **agent-log-frontend**（HH:MM）。

### 常駐指令（測試資料）— 規格 Agent **勿刪**

若在 **Playwright E2E／手動後台／API 腳本** 中**新增寫入後端的資料**：**該次測試跑完後（無論通過或失敗）務必刪除或還原**（spec `afterEach`、`db:seed` 重灌、或 teardown）。勿把髒資料留在共用 DB。

---

## 0. 順序（與後端依賴 — 務必遵守）

| 項目 | 說明 |
|------|------|
| **聯調** | **VITE_API_BASE_URL** 指 :3003；Loyalty 頁面接真 API 前，後端須已完成對應 **B#**（見下表）。 |
| **規格** | UI 對齊 [crm-loyalty-ui-plan.md](../crm-loyalty-ui-plan.md) 範本（深藍側欄、六連結、卡片／表／狀態色塊）。 |

**【順序鎖定】前端步驟 F# 與後端 B# 對應 — 不可跳過**

| 前端步驟 | 須後端先完成 | 說明 |
|----------|--------------|------|
| **F0** | 無 | 僅壳與路由，可與後端 **並行** |
| **F1** | **B1** | 系統設定頁 ← `GET/PATCH /loyalty/settings` |
| **F2** | **B2** | 點數存摺頁 ← `GET /loyalty/point-ledger`；要有資料需後端結帳寫 EARNED |
| **F3** | **B3** | 會員管理表 ← `GET /customers` 含 pointBalance／expiringSoon |
| **F4** | **B4** | 儀表板 ← `GET /loyalty/dashboard` |
| **F5** | **B5（選配）** | Loyalty 內促銷表 + usageCount；未完成則占位「即將推出」或沿用舊 `/admin/promotions` |
| **F6** | **B6（選配）** | 優惠券頁；未完成則占位 |

**開發順序建議（前端內）**：**F0 → F1 → F2 → F4（可與 F3 交換，但 F4 需 B4）→ F3**；會員表依賴 B3，儀表板依賴 B4；**F1 必在 F2 前**（結帳規則先能設，才好驗 EARN 倍率）。

---

## 1. 本輪必做（迴歸 + 富資料本機驗收）

1. **`pnpm --filter pos-erp-frontend build`** 全綠。

2. **本機富 seed 驗收（建議）**：後端 **db:seed** 後開 **Loyalty 儀表板**— 四 KPI 有數、**點數存摺** 全店可見多筆（含 EARNED／BURNED／EXPIRED）；**會員管理** 可見 **M006 黃零點** 等零訂單列與 **M001 林大戶** 多點餘額。

3. **E2E**：**admin-loyalty-smoke** 維持綠或 skip 條件寫清；採購 **admin-bulk**／**admin-smoke** 迴歸不紅。

4. **採購三頁**：勿拆側欄三連結。

5. **docs/agent-collab/agent-log-frontend.md**（**HH:MM** + build／seed 本機摘要）。

**選配**

- **POS 結帳 Modal** 預填試算 **customerId**。  
- Loyalty 存摺依 **訂單號** 深連結至 POS 訂單列表（若路由支援 query）。

---

## 2. 驗收

- [ ] build 綠；agent-log 有本輪 **HH:MM**。  
- [ ] （建議）seed 後 Loyalty 儀表板／存摺／會員表資料豐富可目測。

---

## 3. 禁止

**禁止**不實作 UI、**只改 docs** 當成本輪完成；拆掉採購側欄三連結；在 **B1 未完成** 時偽造設定已寫入後端。

---

## 4. 固定參考

| 後端步驟對照 | [BACKEND-INSTRUCTIONS.md](BACKEND-INSTRUCTIONS.md) §1（Loyalty B# 見上表；上一輪已交付） |
| 範本 | [crm-loyalty-ui-plan.md](../crm-loyalty-ui-plan.md) |
| Seed | [db-seed.md](../db-seed.md) |
| 守則 | [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md) |
| E2E | [e2e-pos.md](../e2e-pos.md) |
