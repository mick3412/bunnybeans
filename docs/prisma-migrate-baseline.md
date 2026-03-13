# Prisma P3005：已有資料庫如何接 `migrate deploy`

## 原因

本機／舊環境若曾用 **`prisma db push`** 建表，DB 裡**已經有表**，但 **`_prisma_migrations` 沒有對應紀錄**。此時執行 `prisma migrate deploy` 會出現：

```text
Error: P3005
The database schema is not empty.
```

這是預期行為：Prisma 無法斷定「歷史 migration 是否已等價於目前 DB」。

## 作法 A：DB 已與目前 schema 一致（曾 db push 到最新）

代表各支 migration 的變更**早已在 DB 裡**，只需**標記為已套用**（baseline），之後 `deploy` 就不會重跑 SQL：

```bash
cd backend
pnpm prisma migrate resolve --applied 20260313120000_add_pos_order_payment
pnpm prisma migrate resolve --applied 20260313180000_pos_order_customer_id
pnpm prisma migrate resolve --applied 20260314100000_product_extended_fields
pnpm prisma migrate deploy   # 應顯示 No pending migrations
```

## 作法 B：舊庫缺「Product 擴充欄位」

若 `Product` 尚無 `description`、`listPrice` 等欄，**不要**對 `20260314100000_product_extended_fields` 做 `resolve --applied`。改為：

1. 先對**確定已存在於 DB 的變更**做 resolve（通常前兩支）：

```bash
cd backend
pnpm prisma migrate resolve --applied 20260313120000_add_pos_order_payment
pnpm prisma migrate resolve --applied 20260313180000_pos_order_customer_id
```

2. 再執行 **`pnpm prisma migrate deploy`**，讓 Prisma **只執行** `product_extended_fields` 那支的 `ALTER TABLE`。

若 deploy 仍報錯，可手動在 DB 執行  
`backend/prisma/migrations/20260314100000_product_extended_fields/migration.sql`，  
再執行：

```bash
pnpm prisma migrate resolve --applied 20260314100000_product_extended_fields
```

## 檢查 Product 是否已有新欄（可選）

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'Product' AND column_name IN ('listPrice', 'description');
```

有列即表示擴充 migration 已等價套用，可直接對該 migration `resolve --applied`。

## 參考

- [Prisma: Baseline a database](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/add-prisma-migrate-to-a-project)
