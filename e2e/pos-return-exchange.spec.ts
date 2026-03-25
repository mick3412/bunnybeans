import { test, expect } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE ?? 'http://127.0.0.1:3003';
const API_KEY = process.env.ADMIN_API_KEY ?? process.env.VITE_ADMIN_API_KEY ?? '';

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function createTestOrder(): Promise<{
  orderId: string;
  storeId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}> {
  const storesRes = await apiGet('stores');
  const stores = storesRes.data ?? [];
  const store = stores[0];
  if (!store) throw new Error('No store found');

  const productsRes = await apiGet(`pos/products?storeId=${store.id}`);
  const products = productsRes.data ?? [];
  const product = products.find((p: { onHandQty: number }) => p.onHandQty >= 3) ?? products[0];
  if (!product) throw new Error('No product found');

  const items = [
    { productId: product.id, quantity: 2, unitPrice: Number(product.salePrice ?? 100) },
  ];

  const orderRes = await apiPost('pos/orders', {
    storeId: store.id,
    items,
    payments: [
      { method: 'CASH', amount: items[0].unitPrice * items[0].quantity },
    ],
  });

  if (orderRes.status >= 300 || !orderRes.data?.id) {
    throw new Error(`Failed to create order: ${JSON.stringify(orderRes.data)}`);
  }

  return { orderId: orderRes.data.id, storeId: store.id, items };
}

test.describe('退換貨系統 API 測試', () => {
  test('全單退貨：preview + execute', async () => {
    const { orderId, items } = await createTestOrder();

    const previewRes = await apiPost(`pos/orders/${orderId}/returns/preview`, {
      type: 'FULL_RETURN',
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        reason: 'CHANGED_MIND',
        condition: 'GOOD',
      })),
      refundMethod: 'CASH',
    });

    expect(previewRes.status).toBe(200);
    expect(previewRes.data.eligible).toBe(true);
    expect(previewRes.data.refundAmount).toBeGreaterThan(0);
    expect(previewRes.data.returnSubtotal).toBeGreaterThan(0);

    const execRes = await apiPost(`pos/orders/${orderId}/returns`, {
      type: 'FULL_RETURN',
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        reason: 'CHANGED_MIND',
        condition: 'GOOD',
      })),
      refundMethod: 'CASH',
      note: 'e2e full return test',
    });

    expect(execRes.status).toBe(201);
    expect(execRes.data.returnNumber).toMatch(/^RTN-/);
    expect(execRes.data.status).toBe('COMPLETED');
    expect(execRes.data.refundAmount).toBeGreaterThan(0);

    const listRes = await apiGet('pos/returns');
    expect(listRes.status).toBe(200);
    expect(listRes.data.items.length).toBeGreaterThan(0);
    const found = listRes.data.items.find(
      (r: { id: string }) => r.id === execRes.data.id,
    );
    expect(found).toBeTruthy();
    expect(found.type).toBe('FULL_RETURN');
  });

  test('部分退貨：折扣分攤驗證', async () => {
    const storesRes = await apiGet('stores');
    const store = storesRes.data[0];
    const productsRes = await apiGet(`pos/products?storeId=${store.id}`);
    const products = productsRes.data ?? [];
    const p1 = products.find((p: { onHandQty: number }) => p.onHandQty >= 3) ?? products[0];
    const p2 =
      products.find(
        (p: { id: string; onHandQty: number }) =>
          p.id !== p1.id && p.onHandQty >= 3,
      ) ?? p1;

    const items = [
      { productId: p1.id, quantity: 2, unitPrice: Number(p1.salePrice ?? 100) },
      { productId: p2.id, quantity: 1, unitPrice: Number(p2.salePrice ?? 200) },
    ];
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const orderRes = await apiPost('pos/orders', {
      storeId: store.id,
      items,
      payments: [{ method: 'CASH', amount: subtotal }],
    });
    expect(orderRes.status).toBeLessThan(300);
    const orderId = orderRes.data.id;

    const previewRes = await apiPost(`pos/orders/${orderId}/returns/preview`, {
      type: 'PARTIAL_RETURN',
      items: [
        { productId: p1.id, quantity: 1, reason: 'SIZE_WRONG', condition: 'GOOD' },
      ],
      refundMethod: 'CASH',
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.data.eligible).toBe(true);
    expect(previewRes.data.returnSubtotal).toBe(Number(p1.salePrice ?? 100));

    const orderDiscount = Number(orderRes.data.discountAmount ?? 0);
    if (orderDiscount > 0) {
      expect(previewRes.data.discountShare).toBeGreaterThan(0);
      expect(previewRes.data.refundAmount).toBeLessThan(
        previewRes.data.returnSubtotal,
      );
    }

    const execRes = await apiPost(`pos/orders/${orderId}/returns`, {
      type: 'PARTIAL_RETURN',
      items: [
        { productId: p1.id, quantity: 1, reason: 'SIZE_WRONG', condition: 'GOOD' },
      ],
      refundMethod: 'CASH',
    });
    expect(execRes.status).toBe(201);
    expect(execRes.data.type).toBe('PARTIAL_RETURN');
  });

  test('換貨補差價', async () => {
    const storesRes = await apiGet('stores');
    const store = storesRes.data[0];
    const productsRes = await apiGet(`pos/products?storeId=${store.id}`);
    const products = productsRes.data ?? [];
    const pOld =
      products.find((p: { onHandQty: number }) => p.onHandQty >= 3) ??
      products[0];
    const pNew =
      products.find(
        (p: { id: string; onHandQty: number }) =>
          p.id !== pOld.id && p.onHandQty >= 2,
      ) ?? pOld;

    const unitPrice = Number(pOld.salePrice ?? 100);
    const orderRes = await apiPost('pos/orders', {
      storeId: store.id,
      items: [{ productId: pOld.id, quantity: 1, unitPrice }],
      payments: [{ method: 'CASH', amount: unitPrice }],
    });
    expect(orderRes.status).toBeLessThan(300);
    const orderId = orderRes.data.id;

    const newUnitPrice = Number(pNew.salePrice ?? 200);
    const previewRes = await apiPost(`pos/orders/${orderId}/returns/preview`, {
      type: 'EXCHANGE',
      items: [
        {
          productId: pOld.id,
          quantity: 1,
          reason: 'WRONG_ITEM',
          condition: 'GOOD',
        },
      ],
      refundMethod: 'CASH',
      exchangeItems: [
        { productId: pNew.id, quantity: 1, unitPrice: newUnitPrice },
      ],
    });
    expect(previewRes.status).toBe(200);
    expect(typeof previewRes.data.deltaAmount).toBe('number');
    expect(previewRes.data.exchangeTotal).toBe(newUnitPrice);

    const exchangePayments =
      previewRes.data.deltaAmount > 0
        ? [{ method: 'CASH', amount: previewRes.data.deltaAmount }]
        : [];

    const execRes = await apiPost(`pos/orders/${orderId}/returns`, {
      type: 'EXCHANGE',
      items: [
        {
          productId: pOld.id,
          quantity: 1,
          reason: 'WRONG_ITEM',
          condition: 'GOOD',
        },
      ],
      refundMethod: 'CASH',
      exchangeItems: [
        { productId: pNew.id, quantity: 1, unitPrice: newUnitPrice },
      ],
      exchangePayments,
      note: 'e2e exchange test',
    });
    expect(execRes.status).toBe(201);
    expect(execRes.data.type).toBe('EXCHANGE');
    expect(execRes.data.exchangeOrder).toBeTruthy();
    expect(execRes.data.exchangeOrder.id).toBeTruthy();
    expect(execRes.data.settlement).toBeTruthy();
    expect(typeof execRes.data.settlement.deltaAmount).toBe('number');
  });

  test('退換貨期限過期驗證', async () => {
    const policyRes = await apiGet('pos/return-policy');
    expect(policyRes.status).toBe(200);
    expect(policyRes.data.returnWindowDays).toBeGreaterThanOrEqual(0);
  });

  test('退貨記錄列表與明細', async () => {
    const listRes = await apiGet('pos/returns?page=1&pageSize=5');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.data.items)).toBe(true);

    if (listRes.data.items.length > 0) {
      const first = listRes.data.items[0];
      const detailRes = await apiGet(`pos/returns/${first.id}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.data.returnNumber).toBe(first.returnNumber);
      expect(Array.isArray(detailRes.data.items)).toBe(true);
    }
  });
});
