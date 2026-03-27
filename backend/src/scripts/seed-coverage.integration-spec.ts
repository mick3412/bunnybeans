import { PrismaClient } from '@prisma/client';

describe('demo seed coverage guard (integration)', () => {
  it('demo seed has minimum report/kpi/list fixtures', async () => {
    if (!process.env.DATABASE_URL) return;

    const prisma = new PrismaClient();
    try {
      const merchant = await prisma.merchant.findFirst({
        where: { code: 'M001' },
        select: { id: true },
      });
      if (!merchant) return;

      const [products, customers, orders, financeEvents, reportAudits] = await Promise.all([
        prisma.product.count(),
        prisma.customer.count({ where: { merchantId: merchant.id } }),
        prisma.posOrder.count({ where: { store: { merchantId: merchant.id } } }),
        prisma.financeEvent.count(),
        prisma.reportClickAudit.count({ where: { merchantId: merchant.id } }),
      ]);

      expect(products).toBeGreaterThan(0);
      expect(customers).toBeGreaterThan(0);
      expect(orders).toBeGreaterThan(0);
      expect(financeEvents).toBeGreaterThan(0);
      expect(reportAudits).toBeGreaterThan(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('food/feed products with expiryDescription have expiry basis', async () => {
    if (!process.env.DATABASE_URL) return;

    const prisma = new PrismaClient();
    try {
      const merchant = await prisma.merchant.findFirst({
        where: { code: 'M001' },
        select: { id: true },
      });
      if (!merchant) return;

      const invalidRows = await prisma.product.findMany({
        where: {
          expiryDescription: { not: null },
          category: {
            code: { in: ['cat-feed', 'cat-hay', 'cat-snacks'] },
          },
          NOT: {
            OR: [
              { expiryDate: { not: null } },
              {
                AND: [{ productionDate: { not: null } }, { shelfLifeMonths: { not: null } }],
              },
            ],
          },
        },
        select: { sku: true },
      });
      expect(invalidRows).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
