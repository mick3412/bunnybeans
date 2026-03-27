# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 060** 追加一筆。

### 前置（必做，快檢查）

- **工作區與依賴檢查**：先看 `git status` / `git diff`，確認本輪起點與未提交項目；同時確認前端驗收所需環境可啟動（dev server、fixture、env）。
- **先做最小可行驗證**：先跑關鍵 smoke（例：`pnpm --filter pos-erp-frontend build`），避免做到一半才發現環境阻塞。
- **E2E DB 隔離（必做）**：跑 E2E 時一律使用 `.env.e2e`（或 `./scripts/e2e-one-click-isolated.sh`）指向隔離測試 DB；**禁止**將 seed/E2E 指向 demo DB（`pos_erp`）。

### 本輪任務（059 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **售後 E2E 可重現跑通（或明文化 skip）** | 針對 `e2e/pos-refund.spec.ts`、`e2e/pos-return-stock.spec.ts`、`e2e/pos-exchange-settlement-journey.spec.ts`：在 **`E2E_PROFILE=full`** 且已跑 `e2e:seed` 之前提下，於本機或 CI **至少驗證一次非全 skip**；若環境無法滿足，須在 `docs/e2e-pos.md` 與 agent-log 以固定格式註記 skip 條件與解法。 |
| 2 | **Loyalty 存摺 tab 中文顯示** | 依 [erp-roadmap.md](../../erp-roadmap.md) §0.6：點數存摺相關 tab／篩選不得只顯示 `EARNED`/`BURNED` 等英文 enum，需改為使用者可讀中文（與既有 enum mapping 一致）。 |
| 3 | **POS 購物車排版穩定（空車／有品項無折讓／有折讓）** | `PosPage` 右側購物車在三種狀態下避免「區塊高度／摘要列」跳動：品項列表區維持合理 `min-height`；「共 N 件」在空車時可顯示 `共 0 件`（muted）；有品項時 **固定顯示「促銷折讓」列**（無折讓時顯示 `—` 或 muted，有折讓時維持綠色金額），使「前往結帳」按鈕位置相對穩定。 |
| 4 | **收銀篩選列重排（不跳行）** | `PosPage` 篩選列調整為：①「無庫存（顯示/不顯示）」獨立到下一行；②「共 X 件」移到欄數區塊左側；③ 欄數切換按鈕維持該區塊右側，避免不同狀態下資訊位移。 |
| 5 | **無庫存 filter 與折扣同行、置右** | `PosPage` 將「無庫存（顯示/不顯示）」移回與「折扣」篩選**同一行**：左側為折扣標籤與折扣 tag 按鈕；**右側**為無庫存切換（建議 `flex` + `justify-between` / `ml-auto` 等，窄螢幕必要時可折行，但語意維持「左折扣、右無庫存」）。 |
| 6 | **退貨完成訊息中的退貨單號可點擊** | 在退換貨操作成功提示中，將「退貨單 RTN-...」改為可點擊連結，導向該筆退貨單明細頁（以 `returnId` 或對應路由參數組 URL）；同時保留既有退款金額等文案資訊。 |
| 7 | **「退換貨」整併至「訂單」頁面（命名調整）** | 側欄與路由層級整併：將原側欄「退換貨」入口整合到「訂單」頁內（同一頁的 tab/分頁）。原「訂單查詢」改名為「訂單總覽」；原「退換貨」改名為「退換貨明細」。驗收：側欄僅保留單一「訂單」入口；進入後可在頁內切換「訂單總覽／退換貨明細」且 URL/選中狀態一致；既有舊 URL 若保留需提供 redirect（避免 404）。 |
| 8 | **評估並移除「退換貨紀錄」tab（若無用途）** | 退換貨頁面（`PosAfterSalesPage` 等）若「退換貨紀錄」tab 進入後長期無資料、且無法與後端 `GET /pos/returns`（或既有 API）在正式 seed 下產出有意義列表，則**移除該 tab** 與相關死碼；若為前端 bug／API 未串／需 seed 才會有資料，則改為修復或補文件化驗收條件，避免空白頁。 |
| 9 | **退換貨列表欄位調整（訂單→原訂單＋退換貨訂單）** | 退換貨列表表格中，現有「訂單」欄改名為「原訂單」；並新增「退換貨訂單」欄，顯示對應退換貨單號（有值時顯示單號，無值時顯示 `—`）。若可導向明細，單號應可點擊連結至對應訂單/單據頁。 |
| 10 | **訂單明細門市欄位顯示名稱而非 ID** | `PosOrderDetailPage`（或相關訂單明細區塊）中的「門市」欄位，改顯示門市名稱（`storeName`）；若名稱缺失才 fallback 顯示 ID，避免主要 UI 直接露出 UUID。 |
| 11 | **訂單明細顯示促銷折扣細節** | 在 `PosOrderDetailPage`（或其明細子元件）補上促銷折扣資訊區：至少顯示「折扣總額」與促銷規則明細（規則名稱／折扣金額）；若有多筆規則需逐條列示。無折扣時顯示明確文案（如「未套用促銷」），避免資訊缺口。 |

### 任務執行中（每項必做）

- **最小驗收即時跑**：每完成一個任務就跑對應最小驗收（例如單支 E2E、局部 build），不要全部堆到最後才驗。

### 收尾（必做，完整驗收）

- **完整回歸**：`pnpm --filter pos-erp-frontend build` 全綠；本輪若跑 E2E，需完成或依上表明確註記 skip。
- **E2E skip 紀錄格式（必填）**：若有 skip，於 agent-log 以 `spec 檔名 + skip code + 前置條件 + 解法` 固定格式記錄。
- **提交與紀錄**：再次檢查 `git status` / `git diff`；有變更必提交 atomic commits，並在 agent-log 列出 sha + message；若無變更需註記「無需 commit（無工作區變更）」。

---
