-- FinanceSnapshot: minimal persisted snapshots list.

CREATE TABLE IF NOT EXISTS "FinanceSnapshot" (
  "id" TEXT NOT NULL,
  "asOfDate" DATE NOT NULL,
  "type" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "summaryJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FinanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceSnapshot_asOfDate_type_key" ON "FinanceSnapshot" ("asOfDate", "type");
CREATE INDEX IF NOT EXISTS "FinanceSnapshot_createdAt_idx" ON "FinanceSnapshot" ("createdAt");

