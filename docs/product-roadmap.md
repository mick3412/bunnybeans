# 商品主檔 — 整合型規格與開發計畫

本文件為**商品／分類／品牌／標籤**的單一總覽：先給出目標、設計原則、API 總覽與階段規劃，最後對照現況。

> 上一輪整合見 [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)。API 細部契約見 [api-design.md](api-design.md) §6。

---

## 一、目標與範圍

### 1.1 目標

- **商品主檔為業務基礎**：Inventory、Order、Purchase 等皆依賴 Product。
- **標籤集中管理**：ProductTag 為後端 master，與 localStorage 脫鉤。
- **規格欄位語意清晰**：specSize、specCapacity、specStyle、specWeight、expiryDescription 取代混用欄位。

### 1.2 範圍

| 範圍 | 說明 |
|------|------|
| **Product** | CRUD、規格五欄（尺寸／容量／重量／款式／效期）、CSV import |
| **Category** | CRUD、enriched（productCount、brandCodes、tags） |
| **Brand** | 列表、CRUD |
| **ProductTag** | CRUD，供商品與類別管理 multi-select |
| **匯入** | POST /products/import、非同步 job（products_csv） |

---

## 二、設計原則

- **sku 唯一**：Product 以 sku 辨識，import 時 sku 存在則更新。
- **規格五欄**：specSize、specCapacity、specStyle、specWeight、expiryDescription；棄用 specColor、weightGrams。
- **tags 接 ProductTag**：商品 tags 為字串陣列，選項來源為 GET /product-tags。
- **分類刪除**：有商品引用時 409 CATEGORY_IN_USE。

---

## 三、API 總覽

| Method | Path | 說明 | 狀態 |
|--------|------|------|------|
| GET | /categories | 列表 | **stable** |
| GET | /categories/enriched | productCount、brandCodes、tags | **stable** |
| POST/PATCH/DELETE | /categories | CRUD | **stable** |
| GET | /brands | 列表 | **stable** |
| GET/POST/PATCH/DELETE | /product-tags | 標籤 master CRUD | **stable** |
| GET | /products | 列表、search、sku、categoryId、brandId、tag | **stable** |
| GET | /products/:id | 單筆 | **stable** |
| POST/PATCH | /products | CRUD | **stable** |
| DELETE | /products/:id | 刪除 | **stable** |
| POST | /products/import | CSV 匯入（ok、failed） | **stable** |
| POST | /imports/jobs/products_csv | 非同步匯入 | **stable** |

---

## 四、階段總覽

| 階段 | 主題 | 後端核心 | 前端核心 |
|------|------|----------|----------|
| **Phase 1** | 基礎 CRUD | Product、Category、Brand、搜尋篩選 | 商品頁、分類、品牌 |
| **Phase 2** | 規格與標籤 | specCapacity、specStyle、specWeight、expiryDescription；ProductTag | 規格五欄、標籤 multi-select |
| **Phase 3** | 匯入與類別管理 | CSV import、enriched、類別三欄 | 商品 import、類別管理三欄（品項／品牌／標籤） |
| **Phase 4** | 非同步匯入 | imports/jobs | 後台輪詢 job 狀態 |

---

## 五、與現況對照

### 5.1 已實作

| 項目 | 後端 | 前端 | 備註 |
|------|------|------|------|
| Product | CRUD、規格五欄、import | AdminProductsPage、規格表單 | 完成 |
| Category | CRUD、enriched | AdminCategoriesPage | 完成 |
| Brand | list、CRUD | 類別管理、商品表單 | 完成 |
| ProductTag | CRUD | 類別管理標籤區、商品標籤 multi-select | 完成 |
| CSV import | POST /products/import | 商品頁匯入 | 完成 |
| 非同步 job | products_csv | 選配 | 後端有，前端可接 |

### 5.2 未實作或選配

| 項目 | 說明 |
|------|------|
| inventory_csv job UI | 庫存盤點非同步匯入前端 | 選配 |

### 5.3 相關文件對照

| 文件 | 覆蓋範圍 |
|------|----------|
| [api-design.md](api-design.md) §6 | 商品／分類／品牌／標籤 API |
| [erp-roadmap.md](erp-roadmap.md) | Phase 1 前期設計問題（0.1～0.5） |
