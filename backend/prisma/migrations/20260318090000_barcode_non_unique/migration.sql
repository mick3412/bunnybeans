-- Drop unique constraint for Product.barcode to allow duplicates
DROP INDEX IF EXISTS "Product_barcode_key";

-- CreateIndex (non-unique) for search performance
CREATE INDEX IF NOT EXISTS "Product_barcode_idx" ON "Product"("barcode");

