import { nid } from "@/lib/money";
import { SCHED, baseGroups, resolveDate, type EventDates } from "@/lib/templates";
import type { BudgetState, PayItem, PayState } from "@/lib/types";

export const DEF_BUDGET: BudgetState = { guests: 180, gTef: 50, gKid: 120, gDej: 30, cont: 8, lines: {} };

export type ItemRow = [string, string, number | string, number, string, boolean?, boolean?, string?];
export type GroupView = { id: string; title: string; when: string; items: ItemRow[]; custom?: boolean };

export function rebuild(B: BudgetState, dates: EventDates) {
  const cu = B.custom || { groups: [], items: [] };
  const GROUPS: GroupView[] = baseGroups(dates)
    .map((g) => ({ id: g.id, title: g.title, when: g.when(dates), items: [] as ItemRow[] }))
    .concat((cu.groups || []).map((g) => ({ id: g.id, title: g.title, when: g.when || "", items: [] as ItemRow[], custom: true })));
  const pool: Record<string, ItemRow> = {};
  const origin: Record<string, string> = {};
  const order: string[] = [];
  baseGroups(dates).forEach((g) =>
    g.items.forEach((it) => {
      const k = g.id + "." + it[0];
      const c: ItemRow = [it[0], it[1], it[2], it[3], it[4], !!it[5], false, k];
      pool[k] = c;
      origin[k] = g.id;
      order.push(k);
    }),
  );
  (cu.items || []).forEach((ci) => {
    const k = ci.g + "." + ci.id;
    pool[k] = [ci.id, ci.label, ci.qk && ci.qk !== "fixe" ? ci.qk : 1, ci.u || 0, "", false, true, k];
    origin[k] = ci.g;
    order.push(k);
  });
  const byId: Record<string, GroupView> = {};
  GROUPS.forEach((g) => (byId[g.id] = g));
  const placed = new Set<string>();
  const lay = B.layout || {};
  GROUPS.forEach((g) =>
    (lay[g.id] || []).forEach((k) => {
      if (pool[k] && !placed.has(k)) {
        g.items.push(pool[k]);
        placed.add(k);
      }
    }),
  );
  order.forEach((k) => {
    if (placed.has(k)) return;
    (byId[origin[k]] || GROUPS[0]).items.push(pool[k]);
    placed.add(k);
  });
  const ITEMS: Record<string, { g: GroupView; it: ItemRow }> = {};
  GROUPS.forEach((g) => g.items.forEach((it) => (ITEMS[it[7] as string] = { g, it })));
  return { GROUPS, ITEMS };
}

export function lineOf(B: BudgetState, it: ItemRow) {
  const k = it[7] as string;
  if (!B.lines[k]) B.lines[k] = { u: it[3] as number, q: typeof it[2] === "number" ? it[2] : null, st: "todo" };
  return B.lines[k];
}

export function qtyOf(B: BudgetState, it: ItemRow, L: { q: number | null }) {
  return typeof it[2] === "string" ? (B as unknown as Record<string, number>)[it[2]] : L.q;
}

export function lineTotal(B: BudgetState, ITEMS: ReturnType<typeof rebuild>["ITEMS"], k: string) {
  if (!ITEMS[k]) return 0;
  const { it } = ITEMS[k];
  const L = lineOf(B, it);
  return (qtyOf(B, it, L) || 0) * (L.u || 0);
}

export function ensurePay(P: PayState, B: BudgetState, dates: EventDates) {
  const { ITEMS } = rebuild(B, dates);
  Object.keys(ITEMS).forEach((k) => {
    if (!P[k]) {
      const tpl = SCHED[k] || [
        { l: "Acompte", p: 30, from: "soir" as const, days: -180 },
        { l: "Solde", p: 70, from: "soir" as const, days: -7 },
      ];
      P[k] = tpl.map((x) => ({
        id: nid(),
        l: x.l,
        p: x.p,
        d: resolveDate(dates, x.from, x.days),
        ok: false,
      }));
    }
  });
  return P;
}

export function paidFor(P: PayState, B: BudgetState, ITEMS: ReturnType<typeof rebuild>["ITEMS"], k: string) {
  return (P[k] || []).filter((e) => e.ok).reduce((s, e) => s + lineTotal(B, ITEMS, k) * (+e.p || 0) / 100, 0);
}

export function totals(B: BudgetState, P: PayState, dates: EventDates) {
  const { GROUPS, ITEMS } = rebuild(B, dates);
  let total = 0,
    eng = 0,
    paid = 0,
    cut = 0,
    nCut = 0;
  const groupTotals: Record<string, number> = {};
  GROUPS.forEach((g) => {
    let gt = 0;
    g.items.forEach((it) => {
      const k = it[7] as string;
      const L = lineOf(B, it);
      const t = lineTotal(B, ITEMS, k);
      if (L.st === "vire") {
        cut += t;
        nCut++;
        return;
      }
      gt += t;
      if (L.st === "reserve" || L.st === "paye") eng += t;
      paid += paidFor(P, B, ITEMS, k);
    });
    groupTotals[g.id] = gt;
    total += gt;
  });
  const c = (total * (B.cont || 0)) / 100;
  return { GROUPS, ITEMS, total, eng, paid, cut, nCut, contingency: c, grand: total + c, groupTotals };
}

export function allPay(B: BudgetState, P: PayState, dates: EventDates) {
  const { ITEMS } = rebuild(B, dates);
  const out: (PayItem & { k: string; ev: string; evl: string; poste: string; amt: number; vire: boolean })[] = [];
  Object.keys(P).forEach((k) => {
    if (!ITEMS[k]) return;
    const { g, it } = ITEMS[k];
    const t = lineTotal(B, ITEMS, k);
    P[k].forEach((e) =>
      out.push({
        ...e,
        k,
        ev: g.id,
        evl: g.title,
        poste: it[1] as string,
        amt: (t * (+e.p || 0)) / 100,
        vire: lineOf(B, it).st === "vire",
      }),
    );
  });
  return out;
}
