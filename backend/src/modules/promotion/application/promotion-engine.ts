/**
 * 促銷引擎（純函式）：條件 AND、行動累加折讓、排他截斷、優先級由呼叫端排序。
 */

export type ConditionType = 'SPEND' | 'QTY' | 'TAG_COMBO';
export type Op = '>=' | '>' | '=' | '<=' | '<';
export type ActionType =
  | 'WHOLE_PERCENT'
  | 'WHOLE_FIXED'
  | 'LINE_PERCENT'
  | 'GIFT_OR_UPSELL';
export type SelectionRule = 'LOWEST_PRICE' | 'HIGHEST_PRICE' | 'ALL';

export interface Condition {
  type: ConditionType;
  op: Op;
  value: number;
  tags?: string[];
}

export interface ActionTier {
  threshold: number;
  discountPercent: number;
}

export interface Action {
  type: ActionType;
  /** WHOLE_PERCENT / LINE_PERCENT：單一折扣％；若有 tiers 則依門檻取最高階 */
  discountPercent?: number;
  /** WHOLE_FIXED：全單折價金額 */
  fixedOff?: number;
  selectionRule?: SelectionRule;
  targetTags?: string[];
  /** GIFT_OR_UPSELL */
  productName?: string;
  upsellAmount?: number;
  tiers?: ActionTier[];
}

export interface CartLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  tags: string[];
}

export interface PromotionRuleInput {
  id: string;
  name: string;
  priority: number;
  draft: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  exclusive: boolean;
  firstPurchaseOnly: boolean;
  memberLevels: string[];
  conditions: Condition[];
  actions: Action[];
}

export interface AppliedPromotion {
  ruleId: string;
  name: string;
  discount: number;
  messages: string[];
}

export interface EngineResult {
  subtotal: number;
  discount: number;
  total: number;
  applied: AppliedPromotion[];
  previewLines: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function compare(op: Op, left: number, right: number): boolean {
  switch (op) {
    case '>=':
      return left >= right;
    case '>':
      return left > right;
    case '=':
      return Math.abs(left - right) < 1e-6;
    case '<=':
      return left <= right;
    case '<':
      return left < right;
    default:
      return false;
  }
}

function tagComboSpend(lines: CartLine[], tags: string[]): number {
  if (!tags?.length) return 0;
  const tagSet = new Set(tags.map((t) => t.trim()).filter(Boolean));
  let sum = 0;
  for (const line of lines) {
    const hit = line.tags.some((t) => tagSet.has(t));
    if (hit) sum += line.quantity * line.unitPrice;
  }
  return round2(sum);
}

function evalConditions(
  conditions: Condition[],
  ctx: {
    subtotal: number;
    totalQty: number;
    lines: CartLine[];
  },
): boolean {
  for (const c of conditions) {
    if (c.type === 'SPEND') {
      if (!compare(c.op, ctx.subtotal, c.value)) return false;
    } else if (c.type === 'QTY') {
      if (!compare(c.op, ctx.totalQty, c.value)) return false;
    } else if (c.type === 'TAG_COMBO') {
      const spend = tagComboSpend(ctx.lines, c.tags ?? []);
      if (!compare(c.op, spend, c.value)) return false;
    } else {
      return false;
    }
  }
  return true;
}

function wholePercentFromAction(
  action: Action,
  subtotal: number,
): { pct: number; label: string } {
  if (action.tiers?.length) {
    const sorted = [...action.tiers].sort((a, b) => b.threshold - a.threshold);
    let pct = 0;
    for (const t of sorted) {
      if (subtotal >= t.threshold) {
        pct = t.discountPercent;
        break;
      }
    }
    return { pct, label: `階梯最高 ${pct}%` };
  }
  const pct = action.discountPercent ?? 0;
  return { pct, label: `${pct}%` };
}

function linePercentBase(
  lines: CartLine[],
  selectionRule: SelectionRule,
  targetTags: string[] | string | undefined,
): number {
  const tags =
    typeof targetTags === 'string'
      ? targetTags.split(',').map((t) => t.trim())
      : targetTags ?? [];
  const tagSet = new Set(tags.filter(Boolean));
  const filtered = lines.filter((line) => {
    if (tagSet.size === 0) return true;
    return line.tags.some((t) => tagSet.has(t));
  });
  if (!filtered.length) return 0;

  if (selectionRule === 'ALL') {
    return round2(
      filtered.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    );
  }
  const unitPrices = filtered.flatMap((l) =>
    Array(l.quantity).fill(l.unitPrice),
  );
  if (!unitPrices.length) return 0;
  if (selectionRule === 'LOWEST_PRICE') {
    return Math.min(...unitPrices);
  }
  return Math.max(...unitPrices);
}

export function ruleAppliesAt(
  rule: PromotionRuleInput,
  at: Date,
): { ok: boolean; reason?: string } {
  if (rule.draft) return { ok: false, reason: 'draft' };
  if (rule.startsAt && at < rule.startsAt) return { ok: false, reason: 'scheduled' };
  if (rule.endsAt && at > rule.endsAt) return { ok: false, reason: 'ended' };
  return { ok: true };
}

export function ruleMatchesCustomer(
  rule: PromotionRuleInput,
  isFirstPurchase: boolean,
  memberLevel: string | null,
): boolean {
  if (rule.firstPurchaseOnly && !isFirstPurchase) return false;
  const levels = rule.memberLevels ?? [];
  if (levels.length > 0) {
    const norm = (memberLevel ?? '').trim();
    if (!norm || !levels.some((l) => l.trim() === norm)) return false;
  }
  return true;
}

export function applyPromotions(
  rules: PromotionRuleInput[],
  lines: CartLine[],
  ctx: {
    at: Date;
    isFirstPurchase: boolean;
    memberLevel: string | null;
  },
): EngineResult {
  const subtotal = round2(
    lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
  );
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  let totalDiscount = 0;
  const applied: AppliedPromotion[] = [];
  const previewLines: string[] = [];

  const condCtx = { subtotal, totalQty, lines };

  for (const rule of sorted) {
    const timeOk = ruleAppliesAt(rule, ctx.at);
    if (!timeOk.ok) continue;
    if (!ruleMatchesCustomer(rule, ctx.isFirstPurchase, ctx.memberLevel))
      continue;
    if (!evalConditions(rule.conditions ?? [], condCtx)) continue;

    let ruleDiscount = 0;
    const messages: string[] = [];

    for (const action of rule.actions ?? []) {
      if (action.type === 'WHOLE_PERCENT') {
        const { pct } = wholePercentFromAction(action, subtotal);
        const d = round2((subtotal * pct) / 100);
        ruleDiscount += d;
        previewLines.push(
          `「${rule.name}」全單 ${pct}% 折讓 $${d.toFixed(2)}`,
        );
      } else if (action.type === 'WHOLE_FIXED') {
        const d = Math.min(subtotal, round2(action.fixedOff ?? 0));
        ruleDiscount += d;
        previewLines.push(`「${rule.name}」全單折價 $${d.toFixed(2)}`);
      } else if (action.type === 'LINE_PERCENT') {
        const base = linePercentBase(
          lines,
          action.selectionRule ?? 'ALL',
          action.targetTags,
        );
        const pct = action.discountPercent ?? 0;
        const d = round2((base * pct) / 100);
        ruleDiscount += d;
        previewLines.push(
          `「${rule.name}」指定商品 ${pct}%（基礎 $${base.toFixed(2)}）折讓 $${d.toFixed(2)}`,
        );
      } else if (action.type === 'GIFT_OR_UPSELL') {
        const gift = (action.upsellAmount ?? 0) <= 0;
        messages.push(
          gift
            ? `贈品：${action.productName ?? '禮品'}`
            : `加價購：${action.productName ?? ''} +$${action.upsellAmount}`,
        );
      }
    }

    ruleDiscount = round2(ruleDiscount);
    totalDiscount = round2(
      Math.min(subtotal, totalDiscount + ruleDiscount),
    );
    if (ruleDiscount > 0 || messages.length) {
      applied.push({
        ruleId: rule.id,
        name: rule.name,
        discount: ruleDiscount,
        messages,
      });
    }
    if (rule.exclusive) {
      break;
    }
  }

  totalDiscount = round2(Math.min(subtotal, totalDiscount));
  return {
    subtotal,
    discount: totalDiscount,
    total: round2(subtotal - totalDiscount),
    applied,
    previewLines,
  };
}

/** 口語化規則摘要（後台預覽；不依賴購物車時僅描述條件+行動） */
export function describeRule(rule: {
  conditions: Condition[];
  actions: Action[];
}): string {
  const condParts: string[] = [];
  for (const c of rule.conditions ?? []) {
    if (c.type === 'SPEND')
      condParts.push(`滿額 ${c.op} $${c.value}`);
    else if (c.type === 'QTY')
      condParts.push(`滿件 ${c.op} ${c.value} 件`);
    else if (c.type === 'TAG_COMBO')
      condParts.push(
        `標籤 [${(c.tags ?? []).join(', ')}] 組合金額 ${c.op} $${c.value}`,
      );
  }
  const actParts: string[] = [];
  for (const a of rule.actions ?? []) {
    if (a.type === 'WHOLE_PERCENT') {
      const { pct } = wholePercentFromAction(a, 999999);
      actParts.push(`全單 ${pct}% 折`);
    } else if (a.type === 'WHOLE_FIXED') {
      actParts.push(`全單折價 $${a.fixedOff ?? 0}`);
    } else if (a.type === 'LINE_PERCENT') {
      actParts.push(
        `指定商品 ${a.discountPercent ?? 0}%（${a.selectionRule ?? 'ALL'}）`,
      );
    } else if (a.type === 'GIFT_OR_UPSELL') {
      actParts.push(
        (a.upsellAmount ?? 0) <= 0
          ? `贈 ${a.productName ?? ''}`
          : `加價購 ${a.productName ?? ''}`,
      );
    }
  }
  const when = condParts.length ? condParts.join('，') : '無條件';
  const then = actParts.length ? actParts.join('；') : '無行動';
  return `當 ${when}，${then}`;
}
