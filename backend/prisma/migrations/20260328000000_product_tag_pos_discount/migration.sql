-- AlterTable
ALTER TABLE "ProductTag" ADD COLUMN "showInPosDiscount" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProductTag" ADD COLUMN "autoCondition" JSONB;
