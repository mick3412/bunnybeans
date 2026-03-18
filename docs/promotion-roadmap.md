# 促銷 — 整合型規格與開發計畫

本文件為**促銷規則與 POS 試算**的單一總覽：先給出目標、設計原則、API 總覽與階段規劃，最後對照現況。

> 上一輪整合見 [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)。細部契約見 [api-promotion-rules.md](api-promotion-rules.md)、[api-design-pos.md](api-design-pos.md)。

---

## 一、目標與範圍

### 1.1 目標

- **促銷引擎與 POS 建單對齊**：preview 的 total 須與 createOrder 的 totalAmount 一致。
- **規則可排程**：draft、startsAt/endsAt 控制檔期；priority 控制評估順序。
- **會員等級篩選**：memberLevels 空＝不限；有值則客戶須命中其一。

### 1.2 範圍

| 範圍 | 說明 |
|------|------|
| **PromotionRule** | 條件（SPEND/QTY/TAG_COMBO）、行動（WHOLE_PERCENT、WHOLE_FIXED、LINE_PERCENT、GIFT_OR_UPSELL）、priority、exclusive |
| **POS 試算** | POST /pos/promotions/preview（subtotal、discount、total、applied） |
| **建單驗證** | createOrder 時 totalAmount 須等於 preview 的 total |
| **與 Loyalty** | POINTS_MULTIPLIER、會員等級篩選 |

---

## 二、設計原則

- **合約先於程式**：preview 與 createOrder 的金額口徑須一致（折前小計、折讓、應收）。
- **規則僅追加**：不提供 DELETE 促銷規則（可設 draft=true 停用）。
- **階梯折扣**：tiers 由高到低比對，只套用第一個達標列。

---

## 三、API 總覽

| Method | Path | 說明 | 狀態 |
|--------|------|------|------|
| GET | /promotion-rules | 列表、status、q 篩選 | **stable** |
| GET | /promotion-rules/:id | 單筆 | **stable** |
| POST | /promotion-rules | 建立 | **stable** |
| PATCH | /promotion-rules/:id | 更新 | **stable** |
| DELETE | /promotion-rules/:id | 刪除 | **stable** |
| PATCH | /promotion-rules/reorder/bulk | 調整 priority 順序 | **stable** |
| POST | /pos/promotions/preview | POS 試算（subtotal、discount、total） | **stable** |

---

## 四、階段總覽

| 階段 | 主題 | 後端核心 | 前端核心 |
|------|------|----------|----------|
| **Phase 1** | 基礎規則 | PromotionRule CRUD、conditions、actions | AdminPromotionsPage、編輯面板 |
| **Phase 2** | POS 試算 | preview、createOrder 驗證 | POS 結帳前試算、建單帶入 |
| **Phase 3** | 進階條件 | TAG_COMBO、memberLevels、firstPurchaseOnly | 規則編輯擴充 |
| **Phase 4** | 與 Loyalty 整合 | POINTS_MULTIPLIER、會員等級 | 設定頁、結帳點數顯示 |

---

## 五、與現況對照

### 5.1 已實作

| 項目 | 後端 | 前端 | 備註 |
|------|------|------|------|
| PromotionRule | CRUD、conditions、actions | AdminPromotionsPage | 完成 |
| POS preview | POST /pos/promotions/preview | POS 結帳試算 | 完成 |
| 建單驗證 | totalAmount 須等於 preview total | POS createOrder | 完成 |
| POINTS_MULTIPLIER | Loyalty 結帳加倍 | 點數顯示 | 完成 |

### 5.2 未實作或選配

| 項目 | 說明 |
|------|------|
| reorder/bulk UI | 後端有 API，前端可補拖曳排序 |
| 促銷成效報表 | 與活動成效整合（crm-member 階段 G） |

### 5.3 相關文件對照

| 文件 | 覆蓋範圍 |
|------|----------|
| [api-promotion-rules.md](api-promotion-rules.md) | 促銷規則契約 |
| [api-design-pos.md](api-design-pos.md) | preview 與建單金額約定 |
| [api-design-loyalty.md](api-design-loyalty.md) | POINTS_MULTIPLIER |
| [crm-member-roadmap.md](crm-member-roadmap.md) | 會員、活動成效 |
| [order-roadmap.md](order-roadmap.md) | POS 訂單建單 |
