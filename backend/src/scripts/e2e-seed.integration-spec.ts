import { PrismaClient } from '@prisma/client';
import { runE2ESeed } from '../../scripts/e2e-seed';

describe('e2e:seed full fixtures (integration)', () => {
  it('E2E_PROFILE=full creates finance report dataset (fail-fast)', async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = new PrismaClient();
    try {
      await runE2ESeed({ profile: 'full', client: prisma });
      const sale = await prisma.financeEvent.count({ where: { referenceId: 'E2E-REPORT-SALE-001' } });
      const pur = await prisma.financeEvent.count({ where: { referenceId: 'E2E-REPORT-PUR-001' } });
      expect(sale).toBeGreaterThanOrEqual(2);
      expect(pur).toBeGreaterThanOrEqual(2);
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);
});

