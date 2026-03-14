import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import {
  getPromotionRule,
  createPromotionRule,
  updatePromotionRule,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

type Cond = { type: string; op: string; value: number; tags?: string[] };
type Act = {
  type: string;
  discountPercent?: number;
  fixedOff?: number;
  selectionRule?: string;
  targetTags?: string;
  productName?: string;
  upsellAmount?: number;
  tiers?: { threshold: number; discountPercent: number }[];
};

const input =
  'mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-[#7EACB5] focus:outline-none focus:ring-2 focus:ring-[#7EACB5]/15';
const select =
  'mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-[#7EACB5] focus:outline-none focus:ring-2 focus:ring-[#7EACB5]/15';
const card = 'rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm';
const label = 'text-xs font-semibold uppercase tracking-wide text-neutral-500';
const sectionTitle = 'text-sm font-semibold text-neutral-900';

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-neutral-50/80 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-neutral-900">{title}</div>
        <div className="mt-0.5 text-xs text-neutral-500">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#7EACB5]' : 'bg-neutral-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function summarizeHuman(conditions: Cond[], actions: Act[]): string {
  const c = (conditions ?? []).map((x) => {
    if (x.type === 'SPEND') return `滿額 ${x.op} $${x.value}`;
    if (x.type === 'QTY') return `滿件 ${x.op} ${x.value} 件`;
    if (x.type === 'TAG_COMBO')
      return `標籤 [${(x.tags ?? []).join('、')}] 組合金額 ${x.op} $${x.value}`;
    return '';
  });
  const parts: string[] = [];
  for (const x of actions ?? []) {
    if (x.type === 'WHOLE_PERCENT') {
      if (x.tiers?.length) {
        const sorted = [...x.tiers].sort((a, b) => b.threshold - a.threshold);
        const desc = sorted
          .map((t) => `滿 $${t.threshold}→全單減價 ${t.discountPercent}%`)
          .join('；');
        parts.push(`階梯（小計由高到低取第一個達標門檻）：${desc}`);
      } else {
        const pct = x.discountPercent ?? 0;
        const fold = Math.max(0, Math.round((1 - pct / 100) * 100));
        if (fold > 0 && fold < 100) parts.push(`全單享 ${fold} 折`);
        else parts.push(`全單 ${pct}% 折`);
      }
    } else if (x.type === 'WHOLE_FIXED') parts.push(`全單折價 $${x.fixedOff ?? 0}`);
    else if (x.type === 'LINE_PERCENT') {
      const rule =
        x.selectionRule === 'LOWEST_PRICE'
          ? '價格最低者'
          : x.selectionRule === 'HIGHEST_PRICE'
            ? '價格最高者'
            : '指定品項';
      parts.push(`${rule} ${x.discountPercent ?? 0}% 折`);
    } else if (x.type === 'GIFT_OR_UPSELL')
      parts.push(
        (x.upsellAmount ?? 0) <= 0
          ? `贈送「${x.productName || '禮品'}」`
          : `加價購「${x.productName}」$${x.upsellAmount}`,
      );
  }
  const when = c.filter(Boolean).join('，') || '無門檻';
  const then = parts.join('；') || '（尚未設定行動）';
  return `當 ${when}，${then}`;
}

export const AdminPromotionEditPage: React.FC = () => {
  const { id } = useParams();
  const isNew = id === 'new';
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get('merchantId') ?? '';
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [priority, setPriority] = useState(1);
  const [draft, setDraft] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [exclusive, setExclusive] = useState(false);
  const [firstPurchaseOnly, setFirstPurchaseOnly] = useState(false);
  const [memberLevelsStr, setMemberLevelsStr] = useState('');
  const [conditions, setConditions] = useState<Cond[]>([]);
  const [actions, setActions] = useState<Act[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () => summarizeHuman(conditions, actions),
    [conditions, actions],
  );

  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      const r = await getPromotionRule(id);
      if ('statusCode' in r) {
        setErr(getErrorMessage(r as ApiError));
        return;
      }
      setName(r.name);
      setPriority(r.priority);
      setDraft(r.draft);
      setStartsAt(r.startsAt ? r.startsAt.slice(0, 10) : '');
      setEndsAt(r.endsAt ? r.endsAt.slice(0, 10) : '');
      setExclusive(r.exclusive);
      setFirstPurchaseOnly(r.firstPurchaseOnly);
      setMemberLevelsStr((r.memberLevels as string[])?.join(', ') ?? '');
      setConditions(
        Array.isArray(r.conditions) ? (r.conditions as Cond[]) : [],
      );
      const loaded = Array.isArray(r.actions)
        ? (r.actions as Act[]).map((act) => {
            if (act.type !== 'WHOLE_PERCENT' || !act.tiers?.length) return act;
            return { ...act, tiers: [...act.tiers] };
          })
        : [];
      setActions(loaded);
    })();
  }, [id, isNew]);

  const save = async (activate: boolean) => {
    if (!merchantId || !name.trim()) {
      setErr('請填促銷名稱；若從列表進入請帶 merchantId');
      return;
    }
    if (!actions.length) {
      setErr('請至少新增一項行動（THEN）');
      return;
    }
    setSaving(true);
    setErr(null);
    const memberLevels = memberLevelsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const actionsForApi = actions.map((act) => {
      if (act.type !== 'WHOLE_PERCENT') return act;
      const tiers = act.tiers?.filter(() => true) ?? [];
      if (!tiers.length) {
        const { tiers: _, ...rest } = act;
        return rest;
      }
      return act;
    });
    const body = {
      merchantId,
      name: name.trim(),
      priority,
      draft: activate ? false : draft,
      startsAt: startsAt ? `${startsAt}T00:00:00.000Z` : null,
      endsAt: endsAt ? `${endsAt}T23:59:59.000Z` : null,
      exclusive,
      firstPurchaseOnly,
      memberLevels,
      conditions,
      actions: actionsForApi,
    };
    if (isNew) {
      const out = await createPromotionRule(body);
      if ('statusCode' in out) setErr(getErrorMessage(out as ApiError));
      else navigate(`/admin/promotions?merchantId=${merchantId}`);
    } else {
      const out = await updatePromotionRule(id!, { ...body, merchantId });
      if ('statusCode' in out) setErr(getErrorMessage(out as ApiError));
      else navigate(`/admin/promotions?merchantId=${merchantId}`);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-full bg-[#F4F8F9] pb-16">
      {/* 頂欄 */}
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={`/admin/promotions${merchantId ? `?merchantId=${merchantId}` : ''}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
              aria-label="返回"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0 text-sm font-medium text-neutral-700">
              {isNew ? '填寫以下欄位後可存草稿或啟用' : '修改後請儲存'}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              className="rounded-xl border-neutral-200"
              onClick={() => save(false)}
            >
              存草稿
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={saving}
              className="rounded-xl px-4 shadow-sm shadow-[#7EACB5]/25"
              onClick={() => save(true)}
            >
              啟用促銷
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {err && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#E3342F] shadow-sm">
            {err}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* 主欄 */}
          <div className="min-w-0 flex-1 space-y-5">
            <section className={card}>
              <h2 className={sectionTitle}>基本資訊</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <div className={label}>促銷名稱</div>
                  <input
                    className={input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例：全館滿千折百"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className={label}>開始日期</div>
                    <input
                      type="date"
                      className={input}
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className={label}>結束日期</div>
                    <input
                      type="date"
                      className={input}
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                    />
                  </div>
                </div>
                <ToggleRow
                  title="排他性"
                  hint="不可與其他優惠並用"
                  checked={exclusive}
                  onChange={setExclusive}
                />
              </div>
            </section>

            <section className={card}>
              <h2 className={sectionTitle}>適用對象 SCOPE</h2>
              <div className="mt-4 space-y-3">
                <ToggleRow
                  title="首購限定"
                  hint="僅限歷史訂單數 = 0 的用戶"
                  checked={firstPurchaseOnly}
                  onChange={setFirstPurchaseOnly}
                />
                <div>
                  <div className={label}>會員等級（逗號分隔）</div>
                  <input
                    className={input}
                    value={memberLevelsStr}
                    onChange={(e) => setMemberLevelsStr(e.target.value)}
                    placeholder="例：VIP, SVIP"
                  />
                </div>
              </div>
            </section>

            <section className={card}>
              <div className="flex items-center justify-between gap-2">
                <h2 className={sectionTitle}>條件 (IF)</h2>
                <button
                  type="button"
                  className="text-sm font-medium text-[#7EACB5] hover:text-[#6B9BA5]"
                  onClick={() =>
                    setConditions((c) => [...c, { type: 'SPEND', op: '>=', value: 0 }])
                  }
                >
                  + 新增條件
                </button>
              </div>
              {conditions.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">
                  尚未新增條件。點「+ 新增條件」後才會出現可編輯列；不新增則視為<strong>無門檻</strong>（IF 永遠通過）。
                </p>
              ) : null}
              <div className="mt-4 space-y-3">
                {conditions.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-neutral-100 bg-[#FAFBFC] p-4"
                  >
                    <div className="mb-3 flex justify-end border-b border-neutral-100 pb-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-[#E3342F] hover:underline"
                        onClick={() =>
                          setConditions((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        移除此條件
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className={label}>類型</div>
                        <select
                          className={select}
                          value={c.type}
                          onChange={(e) => {
                            const t = e.target.value;
                            setConditions((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, type: t, tags: t === 'TAG_COMBO' ? [] : undefined }
                                  : x,
                              ),
                            );
                          }}
                        >
                          <option value="SPEND">滿額</option>
                          <option value="QTY">滿件</option>
                          <option value="TAG_COMBO">商品組合</option>
                        </select>
                      </div>
                      <div>
                        <div className={label}>運算子</div>
                        <select
                          className={select}
                          value={c.op}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, op: e.target.value } : x,
                              ),
                            )
                          }
                        >
                          {['>=', '>', '=', '<=', '<'].map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className={label}>
                          {c.type === 'QTY' ? '件數' : '金額'}
                        </div>
                        <input
                          type="number"
                          className={input}
                          value={c.value}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, value: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                    {c.type === 'TAG_COMBO' && (
                      <div className="mt-3">
                        <div className={label}>商品標籤（逗號分隔）</div>
                        <input
                          className={input}
                          placeholder="例：夏季新品, 配件"
                          value={(c.tags ?? []).join(', ')}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      tags: e.target.value
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className={card}>
              <div className="flex items-center justify-between gap-2">
                <h2 className={sectionTitle}>行動 (THEN)</h2>
                <button
                  type="button"
                  className="text-sm font-medium text-[#7EACB5] hover:text-[#6B9BA5]"
                  onClick={() =>
                    setActions((a) => [...a, { type: 'WHOLE_PERCENT', discountPercent: 10 }])
                  }
                >
                  + 新增行動
                </button>
              </div>
              {actions.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">
                  尚未新增行動。點「+ 新增行動」後才會出現可編輯列；存檔前至少需一項行動。
                </p>
              ) : null}
              <div className="mt-4 space-y-4">
                {actions.map((a, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-neutral-100 bg-[#FAFBFC] p-4"
                  >
                    <div className="mb-3 flex justify-end border-b border-neutral-100 pb-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-[#E3342F] hover:underline"
                        onClick={() =>
                          setActions((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        移除此行動
                      </button>
                    </div>
                    <div className="mb-3">
                      <div className={label}>類型</div>
                      <select
                        className={select}
                        value={a.type}
                        onChange={(e) => {
                          const t = e.target.value;
                          setActions((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? t === 'WHOLE_FIXED'
                                  ? { type: t, fixedOff: 100 }
                                  : t === 'LINE_PERCENT'
                                    ? {
                                        type: t,
                                        discountPercent: 10,
                                        selectionRule: 'LOWEST_PRICE',
                                      }
                                    : t === 'GIFT_OR_UPSELL'
                                      ? { type: t, productName: '', upsellAmount: 0 }
                                      : { type: t, discountPercent: 10 }
                                : x,
                            ),
                          );
                        }}
                      >
                        <option value="WHOLE_PERCENT">全單折扣 (%)</option>
                        <option value="WHOLE_FIXED">全單折價 ($)</option>
                        <option value="LINE_PERCENT">指定商品折扣 (%)</option>
                        <option value="GIFT_OR_UPSELL">加價購 / 贈品</option>
                      </select>
                    </div>
                    {a.type === 'WHOLE_PERCENT' && (
                      <div className="space-y-3">
                        {!(a.tiers?.length) && (
                          <div className="flex flex-wrap items-end gap-4">
                            <div className="min-w-[8rem]">
                              <div className={label}>折扣 (%)</div>
                              <input
                                type="number"
                                className={input}
                                value={a.discountPercent ?? 0}
                                onChange={(e) =>
                                  setActions((prev) =>
                                    prev.map((x, j) =>
                                      j === i
                                        ? {
                                            ...x,
                                            discountPercent: Number(e.target.value),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </div>
                          </div>
                        )}
                        <div className="rounded-xl border border-neutral-100 bg-white/80 p-3">
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-semibold text-neutral-600">
                                階梯式（選用）
                              </span>
                              <p className="mt-1 max-w-xl text-xs leading-relaxed text-neutral-500">
                                每列：<strong>滿 $ 門檻</strong>（購物車折前小計 ≥ 此金額）→
                                <strong>折 %</strong>（全單減收該百分比）。多列時由<strong>高門檻往低</strong>比對，<strong>只套用第一個達標</strong>的那一列（例：小計
                                $1500 同時滿 $1000 與 $500 時，取較高門檻那列的折％）。未設階梯時，以上方「折扣
                                %」為準。
                              </p>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 rounded-lg bg-[#7EACB5] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#6B9BA5]"
                              onClick={() =>
                                setActions((prev) =>
                                  prev.map((x, j) =>
                                    j === i
                                      ? {
                                          ...x,
                                          tiers: [
                                            ...(x.tiers ?? []),
                                            { threshold: 0, discountPercent: 0 },
                                          ],
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              + Add Tier
                            </button>
                          </div>
                          {(a.tiers ?? []).map((t, ti) => (
                            <div
                              key={ti}
                              className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-100 bg-[#FAFBFC] px-3 py-2"
                            >
                              <span className="w-8 text-xs font-medium text-neutral-400">
                                #{ti + 1}
                              </span>
                              <div>
                                <span className="text-[10px] text-neutral-500">滿 $</span>
                                <input
                                  type="number"
                                  placeholder="1000"
                                  className="ml-1 w-20 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                                  value={t.threshold}
                                  onChange={(e) => {
                                    const tiers = [...(a.tiers ?? [])];
                                    tiers[ti] = {
                                      ...t,
                                      threshold: Number(e.target.value),
                                    };
                                    setActions((prev) =>
                                      prev.map((x, j) => (j === i ? { ...x, tiers } : x)),
                                    );
                                  }}
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-neutral-500">折 %</span>
                                <input
                                  type="number"
                                  placeholder="10"
                                  className="ml-1 w-16 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                                  value={t.discountPercent}
                                  onChange={(e) => {
                                    const tiers = [...(a.tiers ?? [])];
                                    tiers[ti] = {
                                      ...t,
                                      discountPercent: Number(e.target.value),
                                    };
                                    setActions((prev) =>
                                      prev.map((x, j) => (j === i ? { ...x, tiers } : x)),
                                    );
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                className="ml-auto text-sm text-[#E3342F] hover:underline"
                                onClick={() => {
                                  const tiers = (a.tiers ?? []).filter((_, idx) => idx !== ti);
                                  setActions((prev) =>
                                    prev.map((x, j) => {
                                      if (j !== i) return x;
                                      if (!tiers.length) {
                                        const { tiers: _, ...rest } = x;
                                        return {
                                          ...rest,
                                          discountPercent: x.discountPercent ?? 10,
                                        };
                                      }
                                      return { ...x, tiers };
                                    }),
                                  );
                                }}
                              >
                                移除
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {a.type === 'WHOLE_FIXED' && (
                      <div>
                        <div className={label}>折價金額 ($)</div>
                        <input
                          type="number"
                          className={input}
                          value={a.fixedOff ?? 0}
                          onChange={(e) =>
                            setActions((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, fixedOff: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                    )}
                    {a.type === 'LINE_PERCENT' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className={label}>折扣 (%)</div>
                          <input
                            type="number"
                            className={input}
                            value={a.discountPercent ?? 0}
                            onChange={(e) =>
                              setActions((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        discountPercent: Number(e.target.value),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <div className={label}>選擇規則</div>
                          <select
                            className={select}
                            value={a.selectionRule ?? 'ALL'}
                            onChange={(e) =>
                              setActions((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? { ...x, selectionRule: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          >
                            <option value="LOWEST_PRICE">價格最低者</option>
                            <option value="HIGHEST_PRICE">價格最高者</option>
                            <option value="ALL">全部</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <div className={label}>目標標籤</div>
                          <input
                            className={input}
                            placeholder="留空 = 購物車全體"
                            value={a.targetTags ?? ''}
                            onChange={(e) =>
                              setActions((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? { ...x, targetTags: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    )}
                    {a.type === 'GIFT_OR_UPSELL' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <div className={label}>商品名稱</div>
                          <input
                            className={input}
                            placeholder="例：限量帆布袋"
                            value={a.productName ?? ''}
                            onChange={(e) =>
                              setActions((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? { ...x, productName: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <div className={label}>加價金額（0 = 贈品）</div>
                          <input
                            type="number"
                            className={input}
                            value={a.upsellAmount ?? 0}
                            onChange={(e) =>
                              setActions((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        upsellAmount: Number(e.target.value),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 側欄 */}
          <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-24 lg:w-80">
            <div className={`${card} border-[#7EACB5]/10 bg-gradient-to-b from-white to-[#FFF4EA]`}>
              <div className="flex items-center gap-2 text-[#7EACB5]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <h2 className="text-sm font-semibold">規則預覽</h2>
              </div>
              <p className="mt-4 leading-relaxed text-neutral-800">{preview}</p>
              <p className="mt-4 text-xs leading-relaxed text-neutral-500">
                啟用後於 POS 依優先級試算；排他規則套用後不再疊加其他活動。
              </p>
            </div>
            <div className={card}>
              <div className={label}>優先級</div>
              <input
                type="number"
                min={1}
                className={`${input} mt-2 text-lg font-semibold tabular-nums`}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) || 1)}
              />
              <p className="mt-2 text-xs text-neutral-500">數字愈小愈先套用</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
