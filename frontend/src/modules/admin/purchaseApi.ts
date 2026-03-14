/**
 * 採購 API — docs/api-design-purchase.md
 * BASE_URL 空時不 throw，回 mock 供 UI 展示。
 */
const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
}

function genTraceId() {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  if (!BASE) {
    return { ok: false, error: { statusCode: 0, message: 'no BASE_URL' } };
  }
  const traceId = genTraceId();
  const url = `${BASE}/${path.replace(/^\//, '')}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Trace-Id': traceId,
    ...(init.headers as Record<string, string>),
  };
  try {
    const res = await fetch(url, { ...init, headers });
    let body: unknown = {};
    try {
      body = await res.json();
    } catch {
      /* empty */
    }
    if (!res.ok) {
      const e = body as Record<string, unknown>;
      return {
        ok: false,
        error: {
          statusCode: res.status,
          message: (e.message as string) ?? res.statusText,
          code: e.code as string | undefined,
        },
      };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error';
    return { ok: false, error: { statusCode: 0, message } };
  }
}

/** 列表 API 結果（BASE 有值且失敗時 error 有值，供 toast / 重試） */
export type PurchaseListResult<T> = { data: T[]; error?: ApiError };

/* ——— mock ——— */
const MOCK_MERCHANT = 'mock-merchant-1';

export type SupplierStatus = 'ACTIVE' | 'INACTIVE';
export interface SupplierDto {
  id: string;
  merchantId: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  taxId?: string | null;
  paymentTerms?: string | null;
  bankAccount?: string | null;
  note?: string | null;
  status: SupplierStatus;
}

let mockSuppliers: SupplierDto[] = [
  {
    id: 'sup-m1',
    merchantId: MOCK_MERCHANT,
    code: 'SUP-001',
    name: '大和紡織股份有限公司',
    contactPerson: '陳志明',
    phone: '02-2345-6789',
    paymentTerms: '月結30天',
    status: 'ACTIVE',
  },
  {
    id: 'sup-m2',
    merchantId: MOCK_MERCHANT,
    code: 'SUP-002',
    name: '宏達成衣廠',
    contactPerson: '林美玲',
    phone: '04-2234-5678',
    status: 'ACTIVE',
  },
  {
    id: 'sup-m3',
    merchantId: MOCK_MERCHANT,
    code: 'SUP-003',
    name: '永豐配件貿易',
    contactPerson: '王建國',
    phone: '03-3345-6789',
    status: 'ACTIVE',
  },
  {
    id: 'sup-m4',
    merchantId: MOCK_MERCHANT,
    code: 'SUP-004',
    name: '光華針織有限公司',
    contactPerson: '張芬',
    phone: '06-2234-5678',
    status: 'INACTIVE',
  },
];

/** 與 api-design-purchase.md §2 一致（無已核准） */
export type PoStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';
export interface PoLineDto {
  id: string;
  productId: string;
  sku?: string;
  name?: string;
  qtyOrdered: number;
  unitCost: number;
  qtyReceived: number;
}
export interface PurchaseOrderDto {
  id: string;
  orderNumber: string;
  merchantId: string;
  supplierId: string;
  supplierName?: string;
  warehouseId: string;
  status: PoStatus;
  expectedDate?: string | null;
  orderDate?: string | null;
  lines: PoLineDto[];
}

let mockPOs: PurchaseOrderDto[] = [
  {
    id: 'po-m1',
    orderNumber: 'PO-2026-001',
    merchantId: MOCK_MERCHANT,
    supplierId: 'sup-m1',
    supplierName: '大和紡織股份有限公司',
    warehouseId: 'wh-m1',
    status: 'RECEIVED',
    expectedDate: '2026-04-01',
    orderDate: '2026-03-01',
    lines: [
      { id: 'pol1', productId: 'p1', sku: 'TX-A1', name: '布疋 A', qtyOrdered: 100, unitCost: 150, qtyReceived: 100 },
      { id: 'pol2', productId: 'p2', sku: 'TX-A2', name: '布疋 B', qtyOrdered: 80, unitCost: 150, qtyReceived: 80 },
    ],
  },
  {
    id: 'po-m2',
    orderNumber: 'PO-2026-002',
    merchantId: MOCK_MERCHANT,
    supplierId: 'sup-m2',
    supplierName: '宏達成衣廠',
    warehouseId: 'wh-m1',
    status: 'ORDERED',
    expectedDate: '2026-04-10',
    orderDate: '2026-03-05',
    lines: [
      {
        id: 'pol-jean',
        productId: 'pj1',
        sku: 'JEAN-BLU-32',
        name: '修身牛仔褲 藍32',
        qtyOrdered: 50,
        unitCost: 380,
        qtyReceived: 0,
      },
    ],
  },
  {
    id: 'po-m3',
    orderNumber: 'PO-2026-003',
    merchantId: MOCK_MERCHANT,
    supplierId: 'sup-m1',
    supplierName: '大和紡織股份有限公司',
    warehouseId: 'wh-m1',
    status: 'ORDERED',
    expectedDate: '2026-04-15',
    orderDate: '2026-03-08',
    lines: [
      { id: 'pol3a', productId: 'p3', sku: 'Y-01', name: '紗線 01', qtyOrdered: 60, unitCost: 100, qtyReceived: 0 },
      { id: 'pol3b', productId: 'p4', sku: 'Y-02', name: '紗線 02', qtyOrdered: 50, unitCost: 116, qtyReceived: 0 },
    ],
  },
  {
    id: 'po-m4',
    orderNumber: 'PO-2026-004',
    merchantId: MOCK_MERCHANT,
    supplierId: 'sup-m3',
    supplierName: '永豐配件貿易',
    warehouseId: 'wh-m1',
    status: 'PARTIALLY_RECEIVED',
    expectedDate: '2026-04-12',
    orderDate: '2026-03-10',
    lines: [
      { id: 'pol4a', productId: 'a1', sku: 'ACC-1', name: '拉鍊組', qtyOrdered: 200, unitCost: 21, qtyReceived: 100 },
      { id: 'pol4b', productId: 'a2', sku: 'ACC-2', name: '鈕扣組', qtyOrdered: 300, unitCost: 14, qtyReceived: 0 },
      { id: 'pol4c', productId: 'a3', sku: 'ACC-3', name: '線材', qtyOrdered: 100, unitCost: 28, qtyReceived: 0 },
    ],
  },
  {
    id: 'po-m5',
    orderNumber: 'PO-2026-005',
    merchantId: MOCK_MERCHANT,
    supplierId: 'sup-m4',
    supplierName: '光華針織有限公司',
    warehouseId: 'wh-m1',
    status: 'DRAFT',
    expectedDate: null,
    lines: [{ id: 'pol5', productId: 'k1', sku: 'KN-01', name: '針織胚布', qtyOrdered: 40, unitCost: 240, qtyReceived: 0 }],
  },
  {
    id: 'po-m6',
    orderNumber: 'PO-2026-086',
    merchantId: MOCK_MERCHANT,
    supplierId: 'sup-m2',
    supplierName: '宏達成衣廠',
    warehouseId: 'wh-m1',
    status: 'CANCELLED',
    expectedDate: null,
    orderDate: '2026-03-01',
    lines: [{ id: 'pol6', productId: 'x1', sku: 'X-01', name: '取消品項', qtyOrdered: 20, unitCost: 380, qtyReceived: 0 }],
  },
];

export type RnStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'RETURNED';
export interface RnLineDto {
  id: string;
  poLineId: string;
  orderedQty: number;
  receivedQty: number;
  qualifiedQty: number;
  returnedQty: number;
  returnReason?: string | null;
}
export interface ReceivingNoteDto {
  id: string;
  number: string;
  merchantId: string;
  purchaseOrderId: string;
  poNumber?: string;
  supplierName?: string;
  status: RnStatus;
  inspectorName?: string | null;
  remark?: string | null;
  lines: RnLineDto[];
  receivedAt?: string | null;
}

let mockRNs: ReceivingNoteDto[] = [];

function poTotal(po: PurchaseOrderDto) {
  const lines = po.lines ?? [];
  return lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitCost), 0);
}

/**
 * 後端列表／詳情含 supplier、lines（詳情行內可含 product）。
 * 一律正規化為 PurchaseOrderDto，避免真 API 未帶 lines 或 supplierName 時白屏。
 */
function normalizePoFromApi(raw: Record<string, unknown>): PurchaseOrderDto {
  const supplier = raw.supplier as { name?: string } | undefined;
  const linesRaw = raw.lines as unknown[] | undefined;
  const lines: PoLineDto[] = Array.isArray(linesRaw)
    ? linesRaw.map((row) => {
        const l = row as Record<string, unknown>;
        const product = l.product as { sku?: string; name?: string } | undefined;
        return {
          id: String(l.id ?? ''),
          productId: String(l.productId ?? ''),
          qtyOrdered: Number(l.qtyOrdered) || 0,
          unitCost: Number(l.unitCost) || 0,
          qtyReceived: Number(l.qtyReceived) || 0,
          sku: (l.sku as string) ?? product?.sku,
          name: (l.name as string) ?? product?.name,
        };
      })
    : [];
  return {
    id: String(raw.id),
    orderNumber: String(raw.orderNumber ?? ''),
    merchantId: String(raw.merchantId ?? ''),
    supplierId: String(raw.supplierId ?? ''),
    supplierName: (raw.supplierName as string) ?? supplier?.name,
    warehouseId: String(raw.warehouseId ?? ''),
    status: raw.status as PoStatus,
    expectedDate: (raw.expectedDate as string) ?? null,
    orderDate: (raw.orderDate as string) ?? null,
    lines,
  };
}

const emptyRnLine = (): RnLineDto => ({
  id: '',
  poLineId: '',
  orderedQty: 0,
  receivedQty: 0,
  qualifiedQty: 0,
  returnedQty: 0,
});

/** 後端列表含 receiptNumber、purchaseOrder、_count；無 _count 時品項數為 0，仍不拋錯 */
function normalizeRnFromApi(raw: Record<string, unknown>): ReceivingNoteDto {
  const po = raw.purchaseOrder as { orderNumber?: string; supplier?: { name?: string } } | undefined;
  const n = Number((raw._count as { lines?: number })?.lines) || 0;
  const lines: RnLineDto[] = Array.from({ length: Math.max(0, n) }, (_, i) => ({
    ...emptyRnLine(),
    id: `list-placeholder-${i}`,
  }));
  const inspectionDate = raw.inspectionDate as string | undefined;
  return {
    id: String(raw.id),
    number: String(raw.receiptNumber ?? raw.number ?? ''),
    merchantId: String(raw.merchantId ?? ''),
    purchaseOrderId: String(raw.purchaseOrderId ?? ''),
    poNumber: po?.orderNumber,
    supplierName: po?.supplier?.name,
    status: raw.status as RnStatus,
    inspectorName: (raw.inspectorName as string) ?? null,
    remark: (raw.remark as string) ?? null,
    lines,
    receivedAt: inspectionDate ?? null,
  };
}

/** 驗收詳情 API：含 lines + purchaseOrderLine；統一成安全 DTO */
function normalizeRnDetailFromApi(raw: Record<string, unknown>): ReceivingNoteDto {
  const linesRaw = raw.lines as unknown[] | undefined;
  const lines: RnLineDto[] = Array.isArray(linesRaw)
    ? linesRaw.map((row) => {
        const l = row as Record<string, unknown>;
        const pol = l.purchaseOrderLine as { id?: string } | undefined;
        return {
          id: String(l.id ?? ''),
          poLineId: String(l.purchaseOrderLineId ?? pol?.id ?? ''),
          orderedQty: Number(l.orderedQty) || 0,
          receivedQty: Number(l.receivedQty) || 0,
          qualifiedQty: Number(l.qualifiedQty) || 0,
          returnedQty: Number(l.returnedQty) || 0,
          returnReason: (l.returnReason as string) ?? null,
        };
      })
    : [];
  const po = raw.purchaseOrder as { orderNumber?: string; supplier?: { name?: string } } | undefined;
  const inspectionDate = raw.inspectionDate as string | undefined;
  return {
    id: String(raw.id),
    number: String(raw.receiptNumber ?? raw.number ?? ''),
    merchantId: String(raw.merchantId ?? ''),
    purchaseOrderId: String(raw.purchaseOrderId ?? ''),
    poNumber: po?.orderNumber,
    supplierName: po?.supplier?.name,
    status: raw.status as RnStatus,
    inspectorName: (raw.inspectorName as string) ?? null,
    remark: (raw.remark as string) ?? null,
    lines,
    receivedAt: inspectionDate ?? null,
  };
}

export async function listSuppliers(merchantId: string, q?: string): Promise<PurchaseListResult<SupplierDto>> {
  if (!BASE) {
    let rows = mockSuppliers.map((s) => ({ ...s, merchantId }));
    if (q?.trim()) {
      const qq = q.trim().toLowerCase();
      rows = rows.filter(
        (s) =>
          s.code.toLowerCase().includes(qq) ||
          s.name.toLowerCase().includes(qq) ||
          s.contactPerson.toLowerCase().includes(qq),
      );
    }
    return { data: rows };
  }
  const qs = new URLSearchParams({ merchantId });
  if (q) qs.set('q', q);
  const out = await req<SupplierDto[]>(`suppliers?${qs}`);
  if (!out.ok) return { data: [], error: out.error };
  return { data: Array.isArray(out.data) ? out.data : [] };
}

export async function createSupplier(body: {
  merchantId: string;
  code: string;
  name: string;
  contactPerson: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  bankAccount?: string;
  note?: string;
  status?: SupplierStatus;
}): Promise<SupplierDto | ApiError> {
  if (!BASE) {
    const s: SupplierDto = {
      id: `sup-${Date.now()}`,
      merchantId: body.merchantId,
      code: body.code,
      name: body.name,
      contactPerson: body.contactPerson,
      phone: body.phone ?? '',
      email: body.email,
      address: body.address,
      taxId: body.taxId,
      paymentTerms: body.paymentTerms,
      bankAccount: body.bankAccount,
      note: body.note,
      status: body.status ?? 'ACTIVE',
    };
    mockSuppliers = [...mockSuppliers, s];
    return s;
  }
  const out = await req<SupplierDto>('suppliers', { method: 'POST', body: JSON.stringify(body) });
  return out.ok ? out.data : out.error;
}

export async function updateSupplier(
  id: string,
  body: Partial<Omit<SupplierDto, 'id' | 'merchantId'>>,
): Promise<SupplierDto | ApiError> {
  if (!BASE) {
    mockSuppliers = mockSuppliers.map((s) => (s.id === id ? { ...s, ...body } : s));
    const s = mockSuppliers.find((x) => x.id === id);
    return s ?? { statusCode: 404, message: 'not found' };
  }
  const out = await req<SupplierDto>(`suppliers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return out.ok ? out.data : out.error;
}

export async function deleteSupplier(id: string): Promise<true | ApiError> {
  if (!BASE) {
    mockSuppliers = mockSuppliers.filter((s) => s.id !== id);
    return true;
  }
  const out = await req<unknown>(`suppliers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return out.ok ? true : out.error;
}

export async function listPurchaseOrders(
  merchantId: string,
  status?: string,
  q?: string,
): Promise<PurchaseListResult<PurchaseOrderDto>> {
  if (!BASE) {
    let rows = mockPOs.map((p) => ({ ...p, merchantId }));
    if (status && status !== 'ALL') rows = rows.filter((p) => p.status === status);
    if (q?.trim()) {
      const qq = q.trim().toLowerCase();
      rows = rows.filter((p) => p.orderNumber.toLowerCase().includes(qq) || (p.supplierName ?? '').toLowerCase().includes(qq));
    }
    return { data: rows };
  }
  const qs = new URLSearchParams({ merchantId });
  if (status && status !== 'ALL') qs.set('status', status);
  if (q) qs.set('q', q);
  const out = await req<unknown>(`purchase-orders?${qs}`);
  if (!out.ok) return { data: [], error: out.error };
  const arr = Array.isArray(out.data) ? out.data : [];
  return { data: arr.map((row) => normalizePoFromApi(row as Record<string, unknown>)) };
}

export async function listPurchaseOrdersReceivable(merchantId: string): Promise<PurchaseListResult<PurchaseOrderDto>> {
  const r = await listPurchaseOrders(merchantId, 'ALL');
  const receivable = r.data.filter((p) => p.status === 'ORDERED' || p.status === 'PARTIALLY_RECEIVED');
  return { data: receivable, error: r.error };
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderDto | ApiError> {
  if (!BASE) {
    const p = mockPOs.find((x) => x.id === id);
    return p ?? { statusCode: 404, message: 'not found' };
  }
  const out = await req<unknown>(`purchase-orders/${encodeURIComponent(id)}`);
  return out.ok ? normalizePoFromApi(out.data as Record<string, unknown>) : out.error;
}

export async function createPurchaseOrder(body: {
  merchantId: string;
  supplierId: string;
  warehouseId: string;
  orderNumber: string;
  expectedDate?: string;
  lines: { productId: string; qtyOrdered: number; unitCost: number }[];
}): Promise<PurchaseOrderDto | ApiError> {
  if (!BASE) {
    const sup = mockSuppliers.find((s) => s.id === body.supplierId);
    const po: PurchaseOrderDto = {
      id: `po-${Date.now()}`,
      orderNumber: body.orderNumber,
      merchantId: body.merchantId,
      supplierId: body.supplierId,
      supplierName: sup?.name,
      warehouseId: body.warehouseId,
      status: 'DRAFT',
      expectedDate: body.expectedDate ?? null,
      lines: body.lines.map((l, i) => ({
        id: `pol-${Date.now()}-${i}`,
        productId: l.productId,
        qtyOrdered: l.qtyOrdered,
        unitCost: l.unitCost,
        qtyReceived: 0,
      })),
    };
    mockPOs = [po, ...mockPOs];
    return po;
  }
  const out = await req<unknown>('purchase-orders', { method: 'POST', body: JSON.stringify(body) });
  return out.ok ? normalizePoFromApi(out.data as Record<string, unknown>) : out.error;
}

export async function submitPo(id: string): Promise<PurchaseOrderDto | ApiError> {
  if (!BASE) {
    mockPOs = mockPOs.map((p) =>
      p.id === id ? { ...p, status: 'ORDERED' as PoStatus, orderDate: new Date().toISOString().slice(0, 10) } : p,
    );
    const p = mockPOs.find((x) => x.id === id);
    return p ?? { statusCode: 404, message: 'not found' };
  }
  const out = await req<unknown>(`purchase-orders/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    body: '{}',
  });
  return out.ok ? normalizePoFromApi(out.data as Record<string, unknown>) : out.error;
}

export async function cancelPo(id: string): Promise<PurchaseOrderDto | ApiError> {
  if (!BASE) {
    mockPOs = mockPOs.map((p) => (p.id === id ? { ...p, status: 'CANCELLED' as PoStatus } : p));
    const p = mockPOs.find((x) => x.id === id);
    return p ?? { statusCode: 404, message: 'not found' };
  }
  const out = await req<unknown>(`purchase-orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: '{}',
  });
  return out.ok ? normalizePoFromApi(out.data as Record<string, unknown>) : out.error;
}

export async function listReceivingNotes(
  merchantId: string,
  status?: string,
  q?: string,
): Promise<PurchaseListResult<ReceivingNoteDto>> {
  if (!BASE) {
    let rows = mockRNs.map((r) => ({ ...r, merchantId }));
    if (status && status !== 'ALL') rows = rows.filter((r) => r.status === status);
    if (q?.trim()) {
      const qq = q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.number.toLowerCase().includes(qq) ||
          (r.poNumber ?? '').toLowerCase().includes(qq) ||
          (r.supplierName ?? '').toLowerCase().includes(qq),
      );
    }
    return { data: rows };
  }
  const qs = new URLSearchParams({ merchantId });
  if (status && status !== 'ALL') qs.set('status', status);
  if (q) qs.set('q', q);
  const out = await req<Record<string, unknown>[]>(`receiving-notes?${qs}`);
  if (!out.ok) return { data: [], error: out.error };
  const rows = Array.isArray(out.data) ? out.data.map((r) => normalizeRnFromApi(r)) : [];
  return { data: rows };
}

export async function getReceivingNote(id: string): Promise<ReceivingNoteDto | ApiError> {
  if (!BASE) {
    const r = mockRNs.find((x) => x.id === id);
    return r ?? { statusCode: 404, message: 'not found' };
  }
  const out = await req<unknown>(`receiving-notes/${encodeURIComponent(id)}`);
  return out.ok ? normalizeRnDetailFromApi(out.data as Record<string, unknown>) : out.error;
}

export async function createReceivingNote(body: {
  merchantId: string;
  purchaseOrderId: string;
  inspectorName?: string;
  remark?: string;
  /** mock：建立時即帶入每列實收／退回，合格 = 實收 - 退回 */
  lineInputs?: { poLineId: string; receivedQty: number; returnedQty: number }[];
}): Promise<ReceivingNoteDto | ApiError> {
  if (!BASE) {
    const po = mockPOs.find((p) => p.id === body.purchaseOrderId);
    if (!po) return { statusCode: 404, message: 'PO not found' };
    const inputs = body.lineInputs ?? [];
    const rn: ReceivingNoteDto = {
      id: `rn-${Date.now()}`,
      number: `RN-${String(mockRNs.length + 1).padStart(4, '0')}`,
      merchantId: body.merchantId,
      purchaseOrderId: po.id,
      poNumber: po.orderNumber,
      supplierName: po.supplierName,
      status: 'IN_PROGRESS',
      inspectorName: body.inspectorName,
      remark: body.remark,
      lines: po.lines.map((l) => {
        const inp = inputs.find((x) => x.poLineId === l.id);
        const receivedQty = inp?.receivedQty ?? l.qtyOrdered - l.qtyReceived;
        const returnedQty = inp?.returnedQty ?? 0;
        const qualifiedQty = Math.max(0, receivedQty - returnedQty);
        return {
          id: `rnl-${l.id}-${Date.now()}`,
          poLineId: l.id,
          orderedQty: l.qtyOrdered - l.qtyReceived,
          receivedQty,
          qualifiedQty,
          returnedQty,
          returnReason: null,
        };
      }),
    };
    mockRNs = [rn, ...mockRNs];
    return rn;
  }
  const out = await req<ReceivingNoteDto>('receiving-notes', { method: 'POST', body: JSON.stringify(body) });
  return out.ok ? out.data : out.error;
}

export async function patchReceivingNoteLines(
  id: string,
  lines: { lineId: string; receivedQty?: number; qualifiedQty?: number; returnedQty?: number; returnReason?: string }[],
): Promise<ReceivingNoteDto | ApiError> {
  if (!BASE) {
    mockRNs = mockRNs.map((r) => {
      if (r.id !== id) return r;
      const newLines = r.lines.map((ln) => {
        const patch = lines.find((x) => x.lineId === ln.id);
        return patch
          ? {
              ...ln,
              receivedQty: patch.receivedQty ?? ln.receivedQty,
              qualifiedQty: patch.qualifiedQty ?? ln.qualifiedQty,
              returnedQty: patch.returnedQty ?? ln.returnedQty,
              returnReason: patch.returnReason ?? ln.returnReason,
            }
          : ln;
      });
      return { ...r, lines: newLines };
    });
    const r = mockRNs.find((x) => x.id === id);
    return r ?? { statusCode: 404, message: 'not found' };
  }
  const out = await req<ReceivingNoteDto>(`receiving-notes/${encodeURIComponent(id)}/lines`, {
    method: 'PATCH',
    body: JSON.stringify({ lines }),
  });
  return out.ok ? out.data : out.error;
}

export async function completeReceivingNote(id: string): Promise<ReceivingNoteDto | ApiError> {
  if (!BASE) {
    const rn = mockRNs.find((r) => r.id === id);
    if (!rn) return { statusCode: 404, message: 'not found' };
    mockRNs = mockRNs.map((r) => (r.id === id ? { ...r, status: 'COMPLETED' as RnStatus, receivedAt: new Date().toISOString() } : r));
    mockPOs = mockPOs.map((po) => {
      if (po.id !== rn.purchaseOrderId) return po;
      const lines = po.lines.map((pl) => {
        const rnl = rn.lines.find((l) => l.poLineId === pl.id);
        const add = rnl?.qualifiedQty ?? 0;
        const qtyReceived = pl.qtyReceived + add;
        return { ...pl, qtyReceived };
      });
      const allReceived = lines.every((l) => l.qtyReceived >= l.qtyOrdered);
      const anyReceived = lines.some((l) => l.qtyReceived > 0);
      let status: PoStatus = po.status;
      if (allReceived) status = 'RECEIVED';
      else if (anyReceived) status = 'PARTIALLY_RECEIVED';
      return { ...po, lines, status };
    });
    return mockRNs.find((x) => x.id === id)!;
  }
  const out = await req<ReceivingNoteDto>(`receiving-notes/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: '{}',
  });
  return out.ok ? out.data : out.error;
}

export async function rejectReceivingNote(id: string): Promise<ReceivingNoteDto | ApiError> {
  if (!BASE) {
    mockRNs = mockRNs.map((r) => (r.id === id ? { ...r, status: 'RETURNED' as RnStatus } : r));
    const r = mockRNs.find((x) => x.id === id);
    return r ?? { statusCode: 404, message: 'not found' };
  }
  const out = await req<ReceivingNoteDto>(`receiving-notes/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: '{}',
  });
  return out.ok ? out.data : out.error;
}

export { poTotal, MOCK_MERCHANT };
