import {
  applyPromotions,
  describeRule,
  ruleAppliesAt,
  ruleMatchesCustomer,
  type PromotionRuleInput,
  type CartLine,
} from './promotion-engine';

const now = new Date('2026-06-01T12:00:00Z');

function baseRule(
  overrides: Partial<PromotionRuleInput> = {},
): PromotionRuleInput {
  return {
    id: 'r1',
    name: '測試',
    priority: 1,
    draft: false,
    startsAt: new Date('2026-01-01'),
    endsAt: new Date('2026-12-31'),
    exclusive: false,
    firstPurchaseOnly: false,
    memberLevels: [],
    conditions: [{ type: 'SPEND', op: '>=', value: 100 }],
    actions: [{ type: 'WHOLE_FIXED', fixedOff: 10 }],
    ...overrides,
  };
}

const lines: CartLine[] = [
  { productId: 'p1', quantity: 2, unitPrice: 100, tags: ['A'] },
];

describe('promotion-engine', () => {
  it('SPEND condition + WHOLE_FIXED', () => {
    const r = baseRule({});
    const out = applyPromotions([r], lines, {
      at: now,
      isFirstPurchase: true,
      memberLevel: null,
    });
    expect(out.subtotal).toBe(200);
    expect(out.discount).toBe(10);
    expect(out.total).toBe(190);
  });

  it('fails SPEND below threshold', () => {
    const r = baseRule({ conditions: [{ type: 'SPEND', op: '>=', value: 999 }] });
    const out = applyPromotions([r], lines, {
      at: now,
      isFirstPurchase: true,
      memberLevel: null,
    });
    expect(out.discount).toBe(0);
    expect(out.total).toBe(200);
  });

  it('QTY condition', () => {
    const r = baseRule({
      conditions: [{ type: 'QTY', op: '>=', value: 2 }],
      actions: [{ type: 'WHOLE_PERCENT', discountPercent: 10 }],
    });
    const out = applyPromotions([r], lines, {
      at: now,
      isFirstPurchase: true,
      memberLevel: null,
    });
    expect(out.discount).toBe(20);
  });

  it('TAG_COMBO', () => {
    const r = baseRule({
      conditions: [
        { type: 'TAG_COMBO', op: '>=', value: 150, tags: ['A'] },
      ],
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 5 }],
    });
    const out = applyPromotions([r], lines, {
      at: now,
      isFirstPurchase: true,
      memberLevel: null,
    });
    expect(out.discount).toBe(5);
  });

  it('tiers pick highest threshold', () => {
    const r = baseRule({
      conditions: [{ type: 'SPEND', op: '>=', value: 0 }],
      actions: [
        {
          type: 'WHOLE_PERCENT',
          tiers: [
            { threshold: 1000, discountPercent: 25 },
            { threshold: 500, discountPercent: 15 },
            { threshold: 0, discountPercent: 5 },
          ],
        },
      ],
    });
    const out = applyPromotions([r], lines, {
      at: now,
      isFirstPurchase: true,
      memberLevel: null,
    });
    // subtotal 200 -> only tier 0 matches -> 5%
    expect(out.discount).toBe(10);
  });

  it('exclusive stops next rule', () => {
    const r1 = baseRule({
      id: '1',
      priority: 1,
      exclusive: true,
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 10 }],
    });
    const r2 = baseRule({
      id: '2',
      priority: 2,
      name: '二',
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 50 }],
    });
    const out = applyPromotions([r1, r2], lines, {
      at: now,
      isFirstPurchase: true,
      memberLevel: null,
    });
    expect(out.discount).toBe(10);
    expect(out.applied.length).toBe(1);
  });

  it('firstPurchaseOnly', () => {
    const r = baseRule({ firstPurchaseOnly: true });
    expect(
      applyPromotions([r], lines, {
        at: now,
        isFirstPurchase: false,
        memberLevel: null,
      }).discount,
    ).toBe(0);
    expect(
      applyPromotions([r], lines, {
        at: now,
        isFirstPurchase: true,
        memberLevel: null,
      }).discount,
    ).toBe(10);
  });

  it('memberLevels', () => {
    const r = baseRule({ memberLevels: ['VIP'] });
    expect(
      applyPromotions([r], lines, {
        at: now,
        isFirstPurchase: true,
        memberLevel: 'GUEST',
      }).discount,
    ).toBe(0);
    expect(
      applyPromotions([r], lines, {
        at: now,
        isFirstPurchase: true,
        memberLevel: 'VIP',
      }).discount,
    ).toBe(10);
  });

  it('draft skipped', () => {
    const r = baseRule({ draft: true });
    expect(
      applyPromotions([r], lines, {
        at: now,
        isFirstPurchase: true,
        memberLevel: null,
      }).discount,
    ).toBe(0);
  });

  it('ruleAppliesAt scheduled', () => {
    const r = baseRule({ startsAt: new Date('2027-01-01') });
    expect(ruleAppliesAt(r, now).ok).toBe(false);
  });

  it('LINE_PERCENT LOWEST_PRICE', () => {
    const L: CartLine[] = [
      { productId: 'p1', quantity: 1, unitPrice: 100, tags: [] },
      { productId: 'p2', quantity: 1, unitPrice: 50, tags: [] },
    ];
    const r = baseRule({
      conditions: [{ type: 'SPEND', op: '>=', value: 0 }],
      actions: [
        {
          type: 'LINE_PERCENT',
          discountPercent: 50,
          selectionRule: 'LOWEST_PRICE',
        },
      ],
    });
    const out = applyPromotions([r], L, {
      at: now,
      isFirstPurchase: true,
      memberLevel: null,
    });
    expect(out.discount).toBe(25);
  });

  it('describeRule', () => {
    const s = describeRule({
      conditions: [{ type: 'SPEND', op: '>=', value: 1000 }],
      actions: [{ type: 'WHOLE_FIXED', fixedOff: 100 }],
    });
    expect(s).toContain('滿額');
    expect(s).toContain('100');
  });
});
