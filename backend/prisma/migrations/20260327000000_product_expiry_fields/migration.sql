-- Product 效期欄位：支援 (a) 生產日期+有效期限(月) 或 (b) 到期日期
ALTER TABLE "Product" ADD COLUMN "productionDate" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "shelfLifeMonths" INTEGER;
ALTER TABLE "Product" ADD COLUMN "expiryDate" TIMESTAMP(3);
