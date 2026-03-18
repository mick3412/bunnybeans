-- AlterTable
ALTER TABLE "ReportClickAudit" ADD COLUMN "resultCode" TEXT;

-- CreateIndex
CREATE INDEX "ReportClickAudit_resultCode_idx" ON "ReportClickAudit"("resultCode");

