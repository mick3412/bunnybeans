-- ReportClickAudit: audit report drilldown clicks (referenceId).

CREATE TABLE IF NOT EXISTS "ReportClickAudit" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT,
  "source" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "resolvedKind" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportClickAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReportClickAudit_merchantId_idx" ON "ReportClickAudit" ("merchantId");
CREATE INDEX IF NOT EXISTS "ReportClickAudit_source_idx" ON "ReportClickAudit" ("source");
CREATE INDEX IF NOT EXISTS "ReportClickAudit_resolvedKind_idx" ON "ReportClickAudit" ("resolvedKind");
CREATE INDEX IF NOT EXISTS "ReportClickAudit_createdAt_idx" ON "ReportClickAudit" ("createdAt");

