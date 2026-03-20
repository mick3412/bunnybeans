-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductTag" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
