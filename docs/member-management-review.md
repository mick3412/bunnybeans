# 會員管理各區塊審視（功能齊全度與待開發）

> 對齊 [crm-loyalty-ui-plan.md](crm-loyalty-ui-plan.md)、[crm-member-roadmap.md](crm-member-roadmap.md)、[api-design-loyalty.md](api-design-loyalty.md)。  
> 審視日：依 **progress/integrated-last-cycle.md** 當輪收斂為準。

---

## 一、現況總覽

| 區塊 | 已具備 | 不齊／待開發 |
|------|--------|----------------|
| **會員管理頁**（L3） | 列表、搜尋（前端 filter）、欄位：會員碼／姓名／電話／等級／點數／即將到期／到期日／加入日；**GET /customers** 含 pointBalance、memberCode、joinDate | **後端** expiringSoon／expiringAt 目前固定 **false／null**，未依 **LoyaltySettings.rollingDays** 計算即將到期點數與到期日；**無單筆新增會員** 表單（僅 CSV 或「後續 POST」）；**無編輯會員** 入口（PATCH /customers/:id 未接 UI）；無會員詳情 Drawer、無「點數流水」連結 |
| **點數存摺**（L2） | PointLedger、全店／依會員查、Tab 類型、referenceId 連訂單、EARNED／BURNED／EXPIRED | 結帳 **BURNED**（折抵）若後端未寫入 PointLedger，則折抵流程未閉環 |
| **儀表板**（L4） | 四 KPI、recentLedger、activePromotions | — |
| **系統設定**（L1） | GET/PATCH loyalty/settings、集點規則／效期／整合占位 | — |
| **優惠券**（L6） | LoyaltyCoupon 模板 CRUD、列表／新增／啟停 | **CustomerCoupon**（發給誰、核銷綁 PosOrder）若未做，則 **POS 選券核銷** 未閉環；後台「發放給會員」需 API |
| **客戶／會員主檔**（crm-member-roadmap A） | Customer 基本欄位 + code/name/phone/email/memberLevel + **memberCode**／**joinDate**；GET 列表；CSV 匯入 preview/apply | **階段 A** 未做：gender、birthDate、address、memberCardNo、registerSource、status（ACTIVE/BLOCKED）、標籤、**合併 API**；**GET/PATCH /customers/:id** 詳情／編輯 API 可能有但後台無入口 |
| **POS 找會員**（crm-member-roadmap B） | POS 結帳可選 customerId（列表或手填 UUID） | **GET /customers/search?q=** 模糊搜尋（電話／姓名／卡號）若未做，則僅能下拉既有列表；掃碼卡號選會員為選配 |

---

## 二、建議補齊優先順序（可納入下一輪 §1）

1. **高**（與現有畫面一致）  
   - **後端**：依 **rollingDays** 與 PointLedger 計算 **expiringSoon**（N 天內到期點數）、**expiringAt**（該筆到期日），並在 **GET /customers** 回傳；契約見 **api-design-loyalty §6**。  
   - **前端**：會員管理頁 **新增會員** Modal（綁 **POST /customers**），欄位至少 name、phone、memberLevel、memberCode 選填。

2. **中**（體驗與閉環）  
   - **後台**：會員列 **編輯** 入口（開 Drawer 綁 **PATCH /customers/:id**）；或「點數流水」連結至點數存摺頁並帶 customerId 篩選。  
   - **結帳 BURNED**：POS 折抵時寫入 PointLedger（type BURNED、referenceId 訂單），與 EARNED 對稱。

3. **低**（進階 CRM）  
   - **crm-member-roadmap 階段 A**：Customer 擴充欄位、合併 API、黑名單 status。  
   - **優惠券閉環**：CustomerCoupon 發放／核銷、POS 選券。  
   - **GET /customers/search**：模糊搜尋供 POS 快速選客。

---

## 三、與 INSTRUCTIONS 的關係

- **BACKEND-INSTRUCTIONS §1** 目前為迴歸 + seed；若下一輪要接「會員管理補齊」，可將 **expiringSoon/expiringAt 計算**、**POST/PATCH customers**（若尚未完整）列為必做或選配。  
- **FRONTEND-INSTRUCTIONS §1** 可將 **會員管理頁新增會員 Modal**、**編輯／點數流水入口** 列為必做或選配。  
- 本審視不修改 INSTRUCTIONS，僅供規格 Agent 與產品決定下一輪焦點。

---

## 四、會員列表與會員管理整合方案

### 4.1 功能差異盤點

| 功能 | AdminCustomersPage（`/admin/customers`） | LoyaltyMembersPage（`/admin/loyalty/members`） |
|------|------------------------------------------|-----------------------------------------------|
| 列表 | GET /customers（listLoyaltyCustomers） | 同左 |
| 篩選 | 搜尋框、等級、狀態、標籤 | 搜尋框（debounce 呼叫 searchCustomers） |
| 新增會員 | 無（僅 CSV 匯入） | 有（Drawer 綁 POST /customers） |
| 編輯會員 | 無 | 有（Drawer 綁 PATCH /customers/:id） |
| 詳情／點數 | 無 | 有（Drawer 顯示 pointBalance、expiringSoon、到期日、加入日） |
| 合併會員 | 有（勾選 2 筆以上 → merge） | 無 |
| 互動紀錄 | 有（Drawer：GET/POST contacts） | 無 |
| 點數流水連結 | 無 | 有（Link 至 point-ledger?customerId=） |
| 分群匯出 | 有（匯出分群名單 CSV） | 無 |

兩頁皆以 `listLoyaltyCustomers` 取得會員列表，差異在於：AdminCustomersPage 偏「列表＋篩選＋合併＋互動紀錄」，LoyaltyMembersPage 偏「單筆新增／編輯／詳情與點數流水」。

### 4.2 建議方案

- **保留 AdminCustomersPage 為唯一入口**：`/admin/customers` 作為「會員列表／會員管理」主頁。
- **將 LoyaltyMembersPage 功能併入**：在 AdminCustomersPage 補上「新增會員」按鈕與 Drawer（POST /customers）、每列「編輯／詳情」入口（PATCH、點數／到期日／點數流水連結）。
- **`/admin/loyalty/members` 改為 redirect**：導向 `/admin/customers`，避免雙入口造成混淆。
- **Phase 3 實施**：本輪僅撰寫提案，不變更路由與實作；待 Phase 3 依 crm-member-roadmap 與產品決策再執行。

### 4.3 對 E2E 與側欄的影響

- **側欄**：移除「會員管理」或改為導向 `/admin/customers`；「會員列表」維持連結 `/admin/customers`。最終僅保留一個會員入口。
- **E2E**：若現有 spec 有 `goto('/admin/loyalty/members')`，改為 `goto('/admin/customers')`；或透過 redirect 仍可到達，但建議直接導向 `/admin/customers` 以簡化斷言。
- **LoyaltyLayout**：若「會員管理」連結改為 redirect，Loyalty 子導覽仍可保留該項，點擊後會導向 AdminCustomersPage。

---

## 五、分群／點數／折價券整合方向

### 5.1 分群（Segments）

- **現況**：`GET /crm/segments` 提供分群列表（id、name）；分群名單匯出、發券等皆以 segmentId 為參數。
- **整合方向**：會員管理頁與分群匯出頁皆以**分群名稱下拉**選取（`listSegments` 提供選項），取代 UUID 手輸；分群管理頁（`/admin/segments`）與會員管理頁維持獨立入口，但匯出流程統一採用名稱選單。

### 5.2 點數（Points）

- **現況**：點數存摺（`/admin/loyalty/point-ledger`）與會員列表（`/admin/customers`）分離；會員列可顯示 pointBalance、expiringSoon。
- **整合方向**：會員管理頁每列可連結至點數存摺（帶 `customerId` 篩選）；未來可考慮在會員詳情 Drawer 內嵌「近期點數流水」摘要。

### 5.3 折價券（Coupons）

- **現況**：LoyaltyCoupon 模板 CRUD、發券 job 綁 segmentId；CustomerCoupon 發放／核銷尚未完全閉環。
- **整合方向**：分群發券流程：選分群（名稱下拉）→ 選券 → 發送；會員詳情可顯示「已領／已核銷」券列表（待 API 支援）；POS 選券核銷與 PointLedger BURNED 對齊。

### 5.4 本輪不改路由

- 以上為整合方向提案，本輪不變更路由與導覽結構。

---

## 六、相關文件

- [crm-loyalty-ui-plan.md](crm-loyalty-ui-plan.md) — 範本六區與 L1～L6  
- [crm-member-roadmap.md](crm-member-roadmap.md) — 階段 A～G  
- [api-design-loyalty.md](api-design-loyalty.md) — §6 客戶列表擴充  
- [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md) — 上一輪收斂與下一輪 §1 連結  

---

## 七、INSTRUCTIONS 021 補充（路由收斂提案摘要）

- 本輪維持「**只寫提案、不改路由**」：`/admin/customers` 與 `/admin/loyalty/members` 並存。
- 建議下一階段收斂為 **單一路由**：以 `/admin/customers` 為唯一會員管理入口，`/admin/loyalty/members` 改 redirect。
- 收斂前置條件：
  - `AdminCustomersPage` 補齊新增/編輯 Drawer（沿用 LoyaltyMembersPage 的 POST/PATCH 能力）。
  - 保留點數存摺導流（`/admin/loyalty/point-ledger?customerId=...`）與互動紀錄。
  - E2E 將直接斷言 `/admin/customers`，減少雙入口造成的維護分歧。
