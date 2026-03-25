# EZTOOL-SQL 與 POS-ERP 差異對照

> 依據客戶提供之 EZTOOL-SQL參考.pdf 與目前專案 schema／roadmap 比對，供需求對齊與遷移規劃參考。

---

## 一、架構差異總覽

| 維度 | EZTOOL-SQL | POS-ERP 現況 |
|------|------------|--------------|
| **多租戶** | 未見 merchant 層 | Merchant → Store → Warehouse 三層 |
| **銷售型態** | 商品 + **服務** 雙軌（銷售明細分開） | 僅 **商品**，無服務品項 |
| **金流設計** | 銷售主檔直接存 應收/已沖/現金/刷卡 等欄位 | 事件型 FinanceEvent（SALE_RECEIVABLE、SALE_PAYMENT 等） |
| **庫存設計** | 庫存檔有 庫存量、訂單未出、採購未到 | 事件型 InventoryEvent + 投影 InventoryBalance |
| **人員** | 員工檔、職稱代碼、打單人員、服務員 | 無員工 master，僅 openedBy/closedBy 等字串 |

---

## 二、模組逐一對照

### 2.1 員工／人員

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 員工檔（員工代碼、職稱、簡稱、底薪、帳號、戶名、離職日、任職日、真實姓名、Email） | — | **無** 員工主檔 |
| 職稱代碼檔 | — | **無** |
| 打單人員、服務員（銷售單上） | PosOrder 無人員欄位；CashRegisterSession 有 openedBy/closedBy | 目前僅關帳有操作者，銷售單無「打單人」 |

**建議**：若需對齊，可於 Phase 2+ 新增 `Employee`、`JobTitle`；PosOrder 加 `createdBy`／`servedBy` 等選填欄位。

---

### 2.2 顧客／會員

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 顧客編號、儲值卡號、姓名、據點、聯絡手機 | Customer (code, name, phone, email, memberCode) | 基本對齊；POS-ERP 有 memberCode |
| 生日、身份證、電話、地址、會員卡號、貴賓卡號 | birthDate 規劃中（crm-roadmap）；無身份證、貴賓卡 | 缺少：身份證、貴賓卡、貴賓卡有效日 |
| 會員卡有效日、貴賓卡有效日 | — | **無** 卡有效日 |
| 累計消費額、起始/最後消費日期 | 可從 PosOrder 彙總 | 未持久化，需即時算或快取 |
| 身分類別、統一編號、發票抬頭 | — | **無** B2B 發票欄位 |
| 收件地址、郵遞區號、收款截止日 | address 規劃中 | 無收款截止日 |
| 備註一/二/三、自行編號 | tags (JSON)、blockReason | 結構不同 |

**建議**：crm-member-roadmap 階段 A 已規劃 birthDate、address、memberCardNo；可增補「卡有效日」「統一編號／發票抬頭」供 B2B。

---

### 2.3 據點／門市

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 據點檔（據點代號、據點名稱） | Store (code, name) | 對齊 |

---

### 2.4 商品

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 商品代號、商品名稱、商品分類、單位、換算單位 | Product (sku, name, categoryId)；Category | 有 Brand、ProductTag；無獨立換算單位檔 |
| 進貨價、員工價、售價、成本 | costPrice、salePrice | 無 **員工價** |
| 條碼、安全量、補貨點 | barcode；safetyStock、replenishmentPoint 於補貨邏輯 | 補貨建議有，商品主檔可補欄位 |
| 失效 | Product 無 | 可用 status 或 active 旗標 |
| 備註、屬性名稱 | description、ProductTag | 結構不同 |

**建議**：可於 Product 新增 `employeePrice`（選填）；換算單位若為「1盒=12罐」等需另建 UnitConversion 模型。

---

### 2.5 服務（重大差異）

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 服務資料（服務項目代號、簡稱、單價、服務分類） | **無** | **完全缺失** |
| 服務分類檔 | — | **無** |
| 銷售明細服務（銷售單號、服務項目、定價、金額、服務員、折扣、服務數量） | — | PosOrderItem 僅商品，**無服務明細** |

**建議**：若客戶為美容、醫美、維修等「商品+服務」混合業態，需評估新增 `Service`、`ServiceCategory` 及「服務明細」；或短期以「虛擬商品」代表服務，但無法區分報表。

---

### 2.6 單位與換算

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 單位檔（單位代號、名稱） | — | 無獨立單位 master |
| 換算單位檔（換算單位代號、單位名稱、換算量） | — | 無；商品若有多單位需自建 |

---

### 2.7 銷售單

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 銷售單號、日期、時間 | orderNumber、createdAt | 對齊 |
| 顧客編號、據點代號 | customerId、storeId | 對齊 |
| 打單人員 | — | 無 |
| 商品金額、項目金額（服務） | subtotalAmount、discountAmount、totalAmount | 無服務分拆 |
| 現金金額、刷卡金額 | PosOrderPayment (method, amount) | 對齊；POS-ERP 以 payment 明細存 |
| 儲值卡號 | — | 無儲值卡扣款 |
| 未稅額、稅額 | — | 目前不區分稅務 |
| 訂單單號、銷退單號 | — | 有退款/退貨 API，無獨立單號關聯 |
| 折扣金額、運費 | discountAmount；無運費 | 無運費欄位 |
| 應收帳款、已沖金額 | FinanceEvent 事件型 | 以事件滾算餘額 |
| 物流商碼、貨運單號、貨運碼 | — | **無** 物流／宅配 |
| 信用卡號、統一編號 | — | 不存敏感資訊；統一編號可於 Customer |
| 來客數 | — | 無 |
| 調撥單號 | 調撥為庫存模組 | 不同用途 |
| 折扣折價卷號 | PromotionRule、LoyaltyCoupon 核銷 | 結構不同，以 reference 關聯 |

**建議**：儲值卡、物流、稅務、來客數可列為 Phase 2+ 擴充；打單人員可加 createdBy。

---

### 2.8 銷售明細

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 銷售明細商品（單號、序號、商品、數量、定價、金額、折扣、摘要） | PosOrderItem (productId, quantity, unitPrice) | 基本對齊；可補 discount、note |
| 銷售明細服務 | **無** | 需服務模組 |

---

### 2.9 庫存

| EZTOOL-SQL | POS-ERP | 差異 |
|------------|---------|------|
| 庫存檔（商品、據點、庫存量、訂單未出、採購未到） | InventoryBalance (onHandQty)；InventoryEvent 事件型 | POS-ERP 以事件滾算；可從訂單/採購推算「未出/未到」 |
| 序號、備註 | — | 事件有 note |

**建議**：補貨建議已含安全庫存；「訂單未出、採購未到」可做為報表擴充（從 PosOrder、PurchaseOrder 彙總）。

---

## 三、功能面差異（無直接對應表）

| 功能 | EZTOOL-SQL | POS-ERP |
|------|------------|---------|
| 儲值卡 | 顧客有儲值卡號；銷售主檔有儲值卡扣款 | **無** 儲值卡模組 |
| 折價券核銷 | 折扣折價卷號 | LoyaltyCoupon 發放／核銷 |
| 物流／宅配 | 物流商、貨運單號、運費 | **無** |
| 多付款方式 | 現金、刷卡、儲值卡 | 現金、刷卡、電子支付等（Payment method） |
| 稅務 | 未稅額、稅額、統一編號 | **無** 稅務拆分 |
| 掛單 | 未見 | PosHeldCart 已實作 |
| 關帳／收銀班次 | 未見 | CashRegisterSession 已實作 |
| 點數／集點 | 未見 | PointLedger、LoyaltySettings 已實作 |
| 分群／發券 | 未見 | Segment、CrmCouponDispatchRule 已實作 |
| 採購／驗收 | 未見（僅庫存採購未到） | PurchaseOrder、ReceivingNote 完整 |
| 調撥 | 調撥單號（銷售主檔？） | 庫存 TRANSFER_OUT/IN |
| 補貨建議 | 安全量、補貨點 | 有補貨建議 API、安全庫存 |

---

## 四、對齊建議優先順序

### 高（若客戶有明確需求）

1. **服務品項**：若為服務業，需 Service + 服務明細。
2. **儲值卡**：若客戶依賴儲值消費，需 PrepaidCard／儲值餘額模組。
3. **員工／打單人**：若需業績歸屬、權限，需 Employee。

### 中（常見擴充）

4. **顧客擴充**：身分類別、統一編號、發票抬頭、卡有效日。
5. **商品員工價**：Product.employeePrice。
6. **稅務**：未稅/稅額拆分（視法規）。
7. **物流**：若含宅配，需運費、貨運單號。

### 低（可後補）

8. **來客數**：報表維度。
9. **單位／換算**：若商品有多單位銷售。

---

## 五、POS-ERP 已有、EZTOOL 未見

- 掛單／取單（PosHeldCart）
- 關帳班次（CashRegisterSession）
- 點數集點（PointLedger）
- 折價券發放／核銷（LoyaltyCoupon）
- 分群／自動發券（Segment、CrmCouponDispatchRule）
- 採購、驗收、供應商
- 庫存調撥、盤點、補貨建議
- 金流事件型設計（可稽核）
- 多商家（Merchant）

---

本檔可作為需求訪談與 roadmap 對齊之檢查清單，後續可依客戶確認逐項納入 INSTRUCTIONS 或 erp-roadmap。
