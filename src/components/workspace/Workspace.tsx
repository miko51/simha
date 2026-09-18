"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EVS, FORMS, QK, buildDays, buildPlan, type EventDates } from "@/lib/templates";
import { DEF_BUDGET, allPay, ensurePay, lineOf, lineTotal, qtyOf, rebuild, totals, type ItemRow } from "@/lib/planning";
import { countdown, eur, fmtDate, nid } from "@/lib/money";
import { rankVendors } from "@/lib/matching";
import { FIND_VENDOR_LABEL, GUEST_GROUPS, VENDOR_LABELS, vendorCategoriesForItem, type BudgetState, type EventRow, type GuestData, type Hall, type MemberRole, type PayState, type Profile, type Synagogue, type TaskState, type Vendor, type VendorCategory } from "@/lib/types";
import { directoryHref } from "@/lib/vendors";
import VendorCard from "@/components/vendors/VendorCard";
import type { CalendarReading } from "@/lib/hebcal";
import { useChat } from "@/components/chat/ChatProvider";
import RabbiAvatar from "@/components/chat/RabbiAvatar";
import MarkdownMessage from "@/components/chat/MarkdownMessage";
import { groupMessagesByDay } from "@/lib/chat";

const TABS = [
  ["budget", "Budget"],
  ["pay", "Échéancier"],
  ["inv", "Invités"],
  ["plan", "Rétroplanning"],
  ["jours", "Jours J"],
  ["vendors", "Prestataires"],
  ["syna", "Synagogues"],
  ["ai", "Assistant"],
  ["settings", "Famille"],
] as const;

type Tab = (typeof TABS)[number][0];

export default function Workspace({
  event: initial,
  role,
  profile,
  synagogues,
  halls,
}: {
  event: EventRow;
  role: MemberRole;
  profile: Profile;
  synagogues: Synagogue[];
  halls: Hall[];
}) {
  const sb = useMemo(() => createClient(), []);
  const canEdit = role === "owner" || role === "editor";
  const [event, setEvent] = useState(initial);
  const [tab, setTab] = useState<Tab>("budget");
  const [B, setB] = useState<BudgetState>({ ...DEF_BUDGET, guests: initial.guests, gTef: initial.g_tef, gKid: initial.g_kid, gDej: initial.g_dej });
  const [P, setP] = useState<PayState>({});
  const [T, setT] = useState<TaskState>({});
  const [G, setG] = useState<Record<string, GuestData>>({});
  const [sync, setSync] = useState("Chargement…");
  const [ready, setReady] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vCat, setVCat] = useState<"" | VendorCategory>("");
  const [reading, setReading] = useState<CalendarReading | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteMsg, setInviteMsg] = useState("");
  const [payEv, setPayEv] = useState("");
  const [payHide, setPayHide] = useState(false);
  const [gSearch, setGSearch] = useState("");
  const [gFGroup, setGFGroup] = useState("");
  const [suggest, setSuggest] = useState({ name: "", city: event.city, notes: "" });
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { messages: aiMsgs, setOpen: setChatOpen, busy: aiBusy } = useChat();

  const dates: EventDates = useMemo(
    () => ({
      child: event.child_first_name,
      kind: event.kind,
      tefilin: event.date_tefilin,
      shabbat: event.date_shabbat,
      party: event.date_party,
      city: event.city,
    }),
    [event],
  );

  const persistGuest = useCallback(
    (id: string, data: GuestData | null) => {
      if (!ready || !canEdit) return;
      clearTimeout(timers.current["g" + id]);
      setSync("Enregistrement…");
      timers.current["g" + id] = setTimeout(async () => {
        const { error } = data
          ? await sb.from("guests").upsert({ id, event_id: event.id, data })
          : await sb.from("guests").delete().eq("id", id);
        setSync(error ? "Échec : " + error.message : "Tout est enregistré · synchronisé en direct");
      }, 500);
    },
    [canEdit, event.id, ready, sb],
  );

  const persist = useCallback(
    (kind: "budget" | "pay" | "tasks", override?: BudgetState | PayState | TaskState) => {
      if (!ready || !canEdit) return;
      clearTimeout(timers.current[kind]);
      setSync("Enregistrement…");
      timers.current[kind] = setTimeout(async () => {
        let error;
        if (kind === "budget") {
          const data = (override as BudgetState) || B;
          ({ error } = await sb.from("app_state").upsert({ event_id: event.id, key: "budget", data }, { onConflict: "event_id,key" }));
        } else if (kind === "tasks") {
          const tasks = (override as TaskState) || T;
          ({ error } = await sb.from("app_state").upsert({ event_id: event.id, key: "tasks", data: { tasks } }, { onConflict: "event_id,key" }));
        } else {
          const pay = (override as PayState) || P;
          ({ error } = await sb.from("app_state").upsert({ event_id: event.id, key: "pay", data: { pay } }, { onConflict: "event_id,key" }));
        }
        setSync(error ? "Échec : " + error.message : "Tout est enregistré · synchronisé en direct");
      }, 500);
    },
    [B, P, T, canEdit, event.id, ready, sb],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [st, gs, vend] = await Promise.all([
        sb.from("app_state").select("key,data").eq("event_id", event.id),
        sb.from("guests").select("id,data").eq("event_id", event.id),
        sb.from("vendors").select("*"),
      ]);
      if (cancelled) return;
      const budget = st.data?.find((r) => r.key === "budget")?.data as BudgetState | undefined;
      const pay = (st.data?.find((r) => r.key === "pay")?.data as { pay?: PayState } | undefined)?.pay;
      const tasks = (st.data?.find((r) => r.key === "tasks")?.data as { tasks?: TaskState } | undefined)?.tasks;
      if (budget) setB({ ...DEF_BUDGET, ...budget, lines: budget.lines || {} });
      const nextP = ensurePay(pay ? { ...pay } : {}, budget || B, dates);
      setP(nextP);
      if (tasks) setT(tasks);
      const guests: Record<string, GuestData> = {};
      gs.data?.forEach((r) => (guests[r.id] = r.data as GuestData));
      setG(guests);
      setVendors((vend.data as Vendor[]) || []);
      setReady(true);
      setSync("Tout est enregistré · synchronisé en direct");
    })();
    const ch = sb
      .channel("evt-" + event.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_state", filter: `event_id=eq.${event.id}` }, (p) => {
        const row = p.new as { key?: string; data?: unknown };
        if (row?.key === "budget") setB({ ...DEF_BUDGET, ...(row.data as BudgetState), lines: (row.data as BudgetState).lines || {} });
        if (row?.key === "pay") setP(((row.data as { pay?: PayState })?.pay) || {});
        if (row?.key === "tasks") setT(((row.data as { tasks?: TaskState })?.tasks) || {});
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "guests", filter: `event_id=eq.${event.id}` }, (p) => {
        setG((cur) => {
          const n = { ...cur };
          if (p.eventType === "DELETE") delete n[(p.old as { id: string }).id];
          else n[(p.new as { id: string; data: GuestData }).id] = (p.new as { data: GuestData }).data;
          return n;
        });
      })
      .subscribe();
    return () => {
      cancelled = true;
      sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  useEffect(() => {
    if (!event.date_shabbat) return;
    const p = new URLSearchParams({ date: event.date_shabbat, kind: event.kind });
    if (event.lat) p.set("lat", String(event.lat));
    if (event.lng) p.set("lng", String(event.lng));
    fetch("/api/hebcal?" + p.toString())
      .then((r) => r.json())
      .then((j) => setReading(j.reading || null))
      .catch(() => null);
  }, [event.date_shabbat, event.kind, event.lat, event.lng]);

  const calc = totals(B, P, dates);
  const pays = allPay(B, P, dates).filter((e) => !e.vire);
  const todayStr = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const nextPay = pays.filter((e) => !e.ok && e.amt > 0).sort((a, b) => (a.d < b.d ? -1 : 1))[0];
  const plan = buildPlan(dates);
  const days = buildDays(dates);
  const matched = rankVendors(vendors, event, vCat || undefined);
  const syna = synagogues.find((s) => s.id === event.synagogue_id);

  function setLine(k: string, f: "u" | "q" | "st", v: string) {
    if (!canEdit) return;
    const { ITEMS } = rebuild(B, dates);
    if (!ITEMS[k]) return;
    const L = lineOf(B, ITEMS[k].it);
    if (f === "st") L.st = v as BudgetState["lines"][string]["st"];
    else L[f] = +v || 0;
    setB({ ...B, lines: { ...B.lines } });
    persist("budget");
  }

  function addGuest(nom: string, nb: number, groupe: string, form: string, counts?: Record<string, number>) {
    const id = nid();
    const inv: GuestData["inv"] = {};
    const n: GuestData["n"] = {};
    EVS.forEach(([e]) => {
      if (counts) {
        const c = +counts[e] || 0;
        inv[e] = c > 0 ? "att" : "";
        n[e] = c;
      } else {
        inv[e] = FORMS[form].includes(e) ? "att" : "";
        n[e] = inv[e] ? nb : 0;
      }
    });
    const g: GuestData = { nom, groupe, n, inv, table: "", note: "", created: Date.now() };
    setG((cur) => ({ ...cur, [id]: g }));
    persistGuest(id, g);
  }

  async function sendInvite() {
    setInviteMsg("");
    const r = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: event.id, email: inviteEmail, role: inviteRole }),
    });
    const j = await r.json();
    setInviteMsg(j.error || "Invitation créée. Lien : " + (j.url || ""));
    if (j.url) setInviteEmail("");
  }

  const pe = calc.total ? Math.min(100, (calc.eng / calc.total) * 100) : 0;
  const pp = calc.total ? Math.min(100, (calc.paid / calc.total) * 100) : 0;

  return (
    <div className="max-w-[1080px] mx-auto px-4 pb-28">
      <header className="pt-8 pb-5">
        <div className="flex justify-between gap-3 flex-wrap">
          <p className="eyebrow">Plan de préparation · {event.kind === "bat" ? "bat" : "bar"} mitzvah</p>
          <div className="text-sm text-[var(--muted)] flex gap-3 items-center">
            <span>{profile.email}</span>
            <Link href="/app" className="text-[var(--tekhelet)]">
              Mes événements
            </Link>
          </div>
        </div>
        <h1 className="text-4xl mt-2">
          {event.kind === "bat" ? "Bat" : "Bar"} mitzvah de {event.child_first_name}
        </h1>
        <p className="text-[var(--muted)] mt-1">
          {event.city}
          {syna ? ` · ${syna.name}` : ""} · minhag {event.minhag}
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mt-5">
          {[
            [event.date_tefilin, "Pose des tefilin"],
            [event.date_shabbat, "Montée à la Torah"],
            [event.date_party, "Soirée"],
          ].map(([d, lab]) => (
            <div key={lab} className="card p-4">
              <b className="font-serif text-lg block">{d ? fmtDate(d) : "Date à fixer"}</b>
              <span className="text-sm text-[var(--muted)]">{lab}</span>
              <div className="text-[var(--tekhelet)] font-semibold text-sm">{countdown(d)}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-5">
        <div className="card p-4 border-t-[3px] border-[var(--tekhelet)] rounded-t-none">
          <small className="text-xs uppercase tracking-wide text-[var(--muted)]">Budget total estimé</small>
          <div className="text-2xl font-bold">{eur(calc.grand)}</div>
          <span className="text-sm text-[var(--muted)]">dont {eur(calc.contingency)} d’imprévus</span>
        </div>
        <div className="card p-4 border-t-[3px] border-[var(--tekhelet)] rounded-t-none">
          <small className="text-xs uppercase tracking-wide text-[var(--muted)]">Engagé</small>
          <div className="text-2xl font-bold">{eur(calc.eng)}</div>
          <div className="h-2 rounded bg-[var(--todo-soft)] flex overflow-hidden mt-2">
            <i className="block h-full bg-[var(--ok)]" style={{ width: pp + "%" }} />
            <i className="block h-full bg-[var(--tekhelet)]" style={{ width: Math.max(0, pe - pp) + "%" }} />
          </div>
        </div>
        <div className="card p-4 border-t-[3px] border-[var(--gold)] rounded-t-none">
          <small className="text-xs uppercase tracking-wide text-[var(--muted)]">Déjà réglé</small>
          <div className="text-2xl font-bold">{eur(calc.paid)}</div>
          <span className="text-sm text-[var(--muted)]">reste {eur(calc.grand - calc.paid)}</span>
        </div>
        <div className="card p-4 border-t-[3px] border-[var(--tekhelet)] rounded-t-none">
          <small className="text-xs uppercase tracking-wide text-[var(--muted)]">Prochaine échéance</small>
          <div className="text-2xl font-bold">{nextPay ? eur(nextPay.amt) : "–"}</div>
          <span className="text-sm text-[var(--muted)]">{nextPay ? `${fmtDate(nextPay.d)} · ${nextPay.poste}` : "Rien à régler"}</span>
        </div>
      </div>

      <nav className="flex gap-1 flex-wrap border-b border-[var(--line)] sticky top-0 bg-[var(--ground)] z-10 pt-2">
        {TABS.map(([id, lab]) => (
          <button
            key={id}
            className={`px-3 py-2 font-semibold border-b-[3px] ${tab === id ? "border-[var(--gold)] text-[var(--ink)]" : "border-transparent text-[var(--muted)]"}`}
            onClick={() => setTab(id)}
          >
            {lab}
          </button>
        ))}
      </nav>

      {tab === "budget" && (
        <section className="mt-5">
          <div className="card p-4 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
            {(
              [
                ["guests", "Invités soirée"],
                ["gTef", "Petit-déj tefilin"],
                ["gKid", "Kiddouch"],
                ["gDej", "Déjeuner famille"],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="flex gap-2 items-center">
                {lab}
                <input
                  type="number"
                  className="w-16"
                  disabled={!canEdit}
                  value={B[k]}
                  onChange={(e) => {
                    const n = +e.target.value || 0;
                    const next = { ...B, [k]: n };
                    setB(next);
                    persist("budget", next);
                    const field = k === "guests" ? "guests" : k === "gTef" ? "g_tef" : k === "gKid" ? "g_kid" : "g_dej";
                    sb.from("events").update({ [field]: n }).eq("id", event.id).then(() => setEvent({ ...event, [field]: n }));
                  }}
                />
              </label>
            ))}
            <label className="flex gap-2 items-center">
              Marge %
              <input
                type="number"
                className="w-16"
                disabled={!canEdit}
                value={B.cont}
                  onChange={(e) => {
                    const next = { ...B, cont: +e.target.value || 0 };
                    setB(next);
                    persist("budget", next);
                  }}
              />
            </label>
          </div>
          {calc.GROUPS.map((g) => (
            <div key={g.id} className="card mt-4 overflow-hidden">
              <div className="flex justify-between p-4 border-b border-[var(--line)]">
                <div>
                  <h2 className="text-xl">{g.title}</h2>
                  <p className="text-sm text-[var(--muted)]">{g.when}</p>
                </div>
                <div className="text-xl font-bold">{eur(calc.groupTotals[g.id] || 0)}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] bg-[var(--ground)]">
                      <th className="p-2">Poste</th>
                      <th className="p-2">Prestataires</th>
                      <th className="p-2 text-right">Qté</th>
                      <th className="p-2 text-right">Prix</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((it: ItemRow) => {
                      const k = it[7] as string;
                      const L = lineOf(B, it);
                      const vendorCats = vendorCategoriesForItem(String(it[0]), String(it[1]));
                      return (
                        <tr key={k} className="border-t border-[var(--line)]">
                          <td className="p-2">
                            {it[1]}
                            {it[4] ? <span className="block text-xs text-[var(--muted)]">{it[4]}</span> : null}
                          </td>
                          <td className="p-2 align-top whitespace-nowrap">
                            {(vendorCats.length ? vendorCats : [null]).map((c) => (
                              <Link
                                key={c || "all"}
                                href={directoryHref(c, event.city)}
                                className="block text-xs font-semibold text-[var(--tekhelet)] hover:underline"
                              >
                                {c ? FIND_VENDOR_LABEL[c] : "Voir l’annuaire"}
                              </Link>
                            ))}
                          </td>
                          <td className="p-2 text-right">
                            {typeof it[2] === "string" ? `${qtyOf(B, it, L) || 0} pers.` : (
                              <input type="number" className="w-16 text-right" disabled={!canEdit} value={L.q ?? 0} onChange={(e) => setLine(k, "q", e.target.value)} />
                            )}
                          </td>
                          <td className="p-2 text-right">
                            <input type="number" className="w-24 text-right" disabled={!canEdit} value={L.u} onChange={(e) => setLine(k, "u", e.target.value)} />
                          </td>
                          <td className="p-2 text-right">{eur(lineTotal(B, calc.ITEMS, k))}</td>
                          <td className="p-2">
                            <select disabled={!canEdit} value={L.st} onChange={(e) => setLine(k, "st", e.target.value)}>
                              <option value="todo">À faire</option>
                              <option value="devis">Devis</option>
                              <option value="reserve">Réservé</option>
                              <option value="paye">Payé</option>
                              <option value="vire">À virer</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {canEdit && (
                <AddItem
                  onAdd={(label, qk, u) => {
                    const id = "c" + nid();
                    const custom = B.custom || { groups: [], items: [] };
                    custom.items = [...(custom.items || []), { id, g: g.id, label, qk, u }];
                    B.lines[g.id + "." + id] = { u, q: qk === "fixe" ? 1 : null, st: "todo" };
                    const nb = { ...B, custom, lines: { ...B.lines } };
                    setB(nb);
                    const np = ensurePay({ ...P }, nb, dates);
                    setP(np);
                    persist("budget", nb);
                    persist("pay", np);
                  }}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "pay" && (
        <PayTab pays={pays} P={P} setP={setP} persist={(pay) => persist("pay", pay)} canEdit={canEdit} payEv={payEv} setPayEv={setPayEv} payHide={payHide} setPayHide={setPayHide} todayStr={todayStr} in30={in30} />
      )}

      {tab === "inv" && (
        <GuestsTab G={G} setG={setG} persistGuest={persistGuest} canEdit={canEdit} gSearch={gSearch} setGSearch={setGSearch} gFGroup={gFGroup} setGFGroup={setGFGroup} addGuest={addGuest} B={B} setB={setB} persistBudget={() => persist("budget")} />
      )}

      {tab === "plan" && (
        <section className="mt-5 grid gap-3">
          {plan.map((p, i) => {
            const done = p.tasks.filter((_, j) => T[i + "-" + j]).length;
            return (
              <div key={p.key} className="card p-4">
                <h3 className="font-semibold">
                  {p.title} <span className="chip bg-[var(--gold-soft)] text-[var(--gold)]">{p.subtitle}</span>
                </h3>
                <div className="text-sm text-[var(--muted)] mb-2">
                  {done}/{p.tasks.length} fait
                </div>
                {p.tasks.map((t, j) => (
                  <label key={j} className={`flex gap-2 py-1 ${T[i + "-" + j] ? "line-through text-[var(--muted)]" : ""}`}>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={!!T[i + "-" + j]}
                      onChange={(e) => {
                        const n = { ...T, [i + "-" + j]: e.target.checked };
                    setT(n);
                    persist("tasks", n);
                      }}
                    />
                    <span>
                      {t[0]}
                      {t[1] ? <em className="not-italic text-xs text-[var(--gold)] font-semibold ml-2">{t[1]}</em> : null}
                    </span>
                  </label>
                ))}
              </div>
            );
          })}
        </section>
      )}

      {tab === "jours" && (
        <section className="mt-5 grid md:grid-cols-3 gap-3">
          {days.map((d) => (
            <div key={d.id} className="card p-4">
              <p className="eyebrow">{fmtDate(d.eyebrow.length === 10 ? d.eyebrow : undefined) || d.eyebrow}</p>
              <h2 className="text-xl mt-1">{d.title}</h2>
              <ol className="mt-2">
                {d.steps.map((s) => (
                  <li key={s[0] + s[1]} className="grid grid-cols-[62px_1fr] gap-2 py-1 border-t border-[var(--line)] text-sm">
                    <b className="text-[var(--tekhelet)]">{s[0]}</b>
                    <span>{s[1]}</span>
                  </li>
                ))}
              </ol>
              <p className="text-sm text-[var(--muted)] mt-3">{d.note}</p>
            </div>
          ))}
        </section>
      )}

      {tab === "vendors" && (
        <section className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <p className="text-sm text-[var(--muted)] max-w-2xl">
              Suggestions pour {event.city}
              {event.budget_envelope ? `, enveloppe ${eur(event.budget_envelope)}` : ""}
              {event.kosher ? `, kasherut ${event.kosher}` : ""}. Chaque fiche ouvre la page complète du prestataire.
            </p>
            <Link href={directoryHref(vCat, event.city)} className="btn">
              Annuaire complet{vCat ? ` · ${VENDOR_LABELS[vCat]}` : ""}
            </Link>
          </div>
          <select value={vCat} onChange={(e) => setVCat(e.target.value as typeof vCat)} className="mb-4">
            <option value="">Toutes les catégories</option>
            {Object.entries(VENDOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="grid md:grid-cols-2 gap-3">
            {matched.length === 0 && (
              <p className="text-[var(--muted)]">
                Aucun prestataire dans ce filtre.{" "}
                <Link href={directoryHref(vCat, event.city)} className="text-[var(--tekhelet)] font-semibold">
                  Ouvrir l’annuaire
                </Link>
              </p>
            )}
            {matched.map((v) => (
              <VendorCard key={v.id} vendor={v} />
            ))}
          </div>
        </section>
      )}

      {tab === "syna" && (
        <section className="mt-5 grid gap-3">
          {synagogues.map((s) => {
            const hs = halls.filter((h) => h.synagogue_id === s.id);
            return (
              <div key={s.id} className={`card p-4 ${s.id === event.synagogue_id ? "ring-2 ring-[var(--gold)]" : ""}`}>
                <div className="flex justify-between gap-2 flex-wrap">
                  <div>
                    <b>{s.name}</b>
                    <div className="text-sm text-[var(--muted)]">
                      {s.city} · {s.rite} {s.address ? `· ${s.address}` : ""}
                    </div>
                    {s.notes && <p className="text-sm mt-1">{s.notes}</p>}
                  </div>
                  {canEdit && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        sb.from("events").update({ synagogue_id: s.id }).eq("id", event.id).then(() => setEvent({ ...event, synagogue_id: s.id }));
                      }}
                    >
                      Choisir
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {hs.map((h) => (
                    <span key={h.id} className="chip bg-[var(--tekhelet-soft)] text-[var(--tekhelet)]">
                      {h.name} · {h.capacity} pl. · {h.usage}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {canEdit && (
            <form
              className="card p-4 grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await sb.from("synagogue_suggestions").insert({
                  event_id: event.id,
                  name: suggest.name,
                  city: suggest.city,
                  notes: suggest.notes,
                  suggested_by: profile.id,
                });
                setSuggest({ name: "", city: event.city, notes: "" });
                setSync("Suggestion envoyée à la modération.");
              }}
            >
              <b>Suggérer une synagogue absente</b>
              <input placeholder="Nom" value={suggest.name} onChange={(e) => setSuggest({ ...suggest, name: e.target.value })} required />
              <input placeholder="Ville" value={suggest.city} onChange={(e) => setSuggest({ ...suggest, city: e.target.value })} required />
              <textarea placeholder="Adresse, rite, contenance…" value={suggest.notes} onChange={(e) => setSuggest({ ...suggest, notes: e.target.value })} />
              <button className="btn" type="submit">
                Envoyer
              </button>
            </form>
          )}
        </section>
      )}

      {tab === "ai" && (
        <section className="mt-5">
          {reading && (
            <div className="bg-[var(--gold-soft)] rounded-lg p-4 text-sm mb-4">
              <b>Lecture du calendrier (Hebcal)</b>
              {reading.parasha && <p className="mt-1">Paracha : {reading.parasha.title}</p>}
              {reading.candles && <p>{reading.candles.title}</p>}
              {reading.havdalah && <p>{reading.havdalah.title}</p>}
              <ul className="list-disc pl-4 mt-1">
                {reading.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <RabbiAvatar size={52} />
              <div>
                <h2 className="text-xl">Journal de Rav Simha</h2>
                <p className="text-sm text-[var(--muted)]">Tout ce que vous lui avez demandé, ici et depuis la bulle.</p>
              </div>
            </div>
            <button type="button" className="btn" onClick={() => setChatOpen(true)}>
              Continuer le chat
            </button>
          </div>
          <div className="card p-4 grid gap-5">
            {aiMsgs.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                Encore aucune conversation. Cliquez sur le petit rav en bas à droite — ou sur « Continuer le chat ».
              </p>
            )}
            {groupMessagesByDay(aiMsgs).map((g) => (
              <div key={g.label}>
                <p className="eyebrow mb-2">{g.label}</p>
                <div className="grid gap-2">
                  {g.items.map((m, i) => (
                    <div key={m.id || i} className={`p-3 rounded-xl ${m.role === "user" ? "bg-[var(--tekhelet-soft)] ml-8" : "bg-[var(--ground)] mr-8"}`}>
                      <div className="text-xs text-[var(--muted)] mb-1 flex justify-between gap-2">
                        <span>{m.role === "user" ? "Vous" : "Rav Simha"}</span>
                        {m.created_at && (
                          <span>
                            {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      {m.role === "user" ? (
                        <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                      ) : (
                        <MarkdownMessage text={m.content} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {aiBusy && <p className="text-sm text-[var(--gold)]">Le petit Rav réfléchit…</p>}
            <p className="text-xs text-[var(--muted)]">40 messages / jour. L’IA ne remplace pas un rabbin. Les horaires viennent de Hebcal.</p>
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="mt-5 card p-4 grid gap-3">
          <h2 className="text-xl">Inviter la famille</h2>
          <p className="text-sm text-[var(--muted)]">Les éditeurs peuvent tout modifier. Les lecteurs voient le plan sans l’éditer.</p>
          {role === "owner" || role === "editor" ? (
            <>
              <input type="email" placeholder="email@famille.fr" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}>
                <option value="editor">Éditeur</option>
                <option value="viewer">Lecture seule</option>
              </select>
              <button className="btn" onClick={sendInvite}>
                Créer l’invitation
              </button>
              {inviteMsg && <p className="text-sm">{inviteMsg}</p>}
            </>
          ) : (
            <p>Seul un éditeur peut inviter.</p>
          )}
        </section>
      )}

      <p className="text-xs text-[var(--muted)] mt-6">{sync} · rôle {role}</p>
    </div>
  );
}

function AddItem({ onAdd }: { onAdd: (label: string, qk: string, u: number) => void }) {
  const [label, setLabel] = useState("");
  const [qk, setQk] = useState("fixe");
  const [u, setU] = useState("");
  return (
    <div className="flex flex-wrap gap-2 p-4 border-t border-[var(--line)] bg-[var(--ground)]">
      <input className="flex-1 min-w-[160px]" placeholder="Nouveau poste" value={label} onChange={(e) => setLabel(e.target.value)} />
      <select value={qk} onChange={(e) => setQk(e.target.value)}>
        {Object.entries(QK).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input type="number" className="w-28" placeholder="Prix €" value={u} onChange={(e) => setU(e.target.value)} />
      <button
        className="btn"
        onClick={() => {
          if (!label.trim()) return;
          onAdd(label.trim(), qk, +u || 0);
          setLabel("");
          setU("");
        }}
      >
        Ajouter
      </button>
    </div>
  );
}

function PayTab({
  pays,
  P,
  setP,
  persist,
  canEdit,
  payEv,
  setPayEv,
  payHide,
  setPayHide,
  todayStr,
  in30,
}: {
  pays: ReturnType<typeof allPay>;
  P: PayState;
  setP: (p: PayState) => void;
  persist: (pay: PayState) => void;
  canEdit: boolean;
  payEv: string;
  setPayEv: (s: string) => void;
  payHide: boolean;
  setPayHide: (b: boolean) => void;
  todayStr: string;
  in30: string;
}) {
  const late = pays.filter((e) => !e.ok && e.d && e.d < todayStr);
  const soon = pays.filter((e) => !e.ok && e.d >= todayStr && e.d <= in30);
  const sum = (a: typeof pays) => a.reduce((s, e) => s + e.amt, 0);
  const list = pays.filter((e) => (!payEv || e.ev === payEv) && (!payHide || !e.ok)).sort((a, b) => (a.d || "9").localeCompare(b.d || "9"));
  return (
    <section className="mt-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-4">
        <div className="card p-3">
          <b>En retard</b>
          <div className="text-xl font-bold text-[var(--vire)]">{eur(sum(late))}</div>
        </div>
        <div className="card p-3">
          <b>30 prochains jours</b>
          <div className="text-xl font-bold">{eur(sum(soon))}</div>
        </div>
        <div className="card p-3">
          <b>Réglé</b>
          <div className="text-xl font-bold">{eur(sum(pays.filter((e) => e.ok)))}</div>
        </div>
      </div>
      <div className="flex gap-3 mb-3">
        <select value={payEv} onChange={(e) => setPayEv(e.target.value)}>
          <option value="">Tous les événements</option>
          <option value="tef">Tefilin</option>
          <option value="shab">Shabbat</option>
          <option value="soir">Soirée</option>
        </select>
        <label className="flex gap-2 items-center text-sm">
          <input type="checkbox" checked={payHide} onChange={(e) => setPayHide(e.target.checked)} /> Masquer les réglées
        </label>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--muted)]">
              <th className="p-2">Date</th>
              <th className="p-2">Poste</th>
              <th className="p-2">Libellé</th>
              <th className="p-2 text-right">%</th>
              <th className="p-2 text-right">Montant</th>
              <th className="p-2">Réglé</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t border-[var(--line)]">
                <td className="p-2">
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={e.d || ""}
                    onChange={(ev) => {
                      const x = P[e.k].find((z) => z.id === e.id);
                      if (x) x.d = ev.target.value;
                      setP({ ...P });
                      persist({ ...P });
                    }}
                  />
                </td>
                <td className="p-2">
                  <span className="chip bg-[var(--tekhelet-soft)] text-[var(--tekhelet)]">{e.evl}</span> {e.poste}
                </td>
                <td className="p-2">{e.l}</td>
                <td className="p-2 text-right">{e.p}</td>
                <td className="p-2 text-right">{eur(e.amt)}</td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={e.ok}
                    onChange={(ev) => {
                      const x = P[e.k].find((z) => z.id === e.id);
                      if (x) x.ok = ev.target.checked;
                      setP({ ...P });
                      persist({ ...P });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GuestsTab({
  G,
  setG,
  persistGuest,
  canEdit,
  gSearch,
  setGSearch,
  gFGroup,
  setGFGroup,
  addGuest,
  B,
  setB,
  persistBudget,
}: {
  G: Record<string, GuestData>;
  setG: React.Dispatch<React.SetStateAction<Record<string, GuestData>>>;
  persistGuest: (id: string, data: GuestData | null) => void;
  canEdit: boolean;
  gSearch: string;
  setGSearch: (s: string) => void;
  gFGroup: string;
  setGFGroup: (s: string) => void;
  addGuest: (nom: string, nb: number, groupe: string, form: string, counts?: Record<string, number>) => void;
  B: BudgetState;
  setB: (b: BudgetState) => void;
  persistBudget: () => void;
}) {
  const [nom, setNom] = useState("");
  const [nb, setNb] = useState(2);
  const [grp, setGrp] = useState(GUEST_GROUPS[0]);
  const [form, setForm] = useState("all");
  const [paste, setPaste] = useState("");
  const pers = (x: GuestData, e: string) => (x.n && x.n[e] != null ? +x.n[e] || 0 : 0);
  const stats = EVS.map(([e, lab]) => {
    let inv = 0,
      oui = 0,
      non = 0,
      att = 0,
      foy = 0;
    Object.values(G).forEach((x) => {
      const v = x.inv?.[e];
      if (!v) return;
      const n = pers(x, e);
      foy++;
      inv += n;
      if (v === "oui") oui += n;
      else if (v === "non") non += n;
      else att += n;
    });
    return { e, lab, inv, oui, non, att, foy };
  });
  const ids = Object.keys(G)
    .filter((id) => {
      const x = G[id];
      if (gSearch && !(x.nom || "").toLowerCase().includes(gSearch.toLowerCase())) return false;
      if (gFGroup && x.groupe !== gFGroup) return false;
      return true;
    })
    .sort((a, b) => (G[a].nom || "").localeCompare(G[b].nom || "", "fr"));

  return (
    <section className="mt-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.e} className="card p-3">
            <b>{s.lab}</b>
            <div className="text-2xl font-bold">
              {s.oui}
              <span className="text-sm text-[var(--muted)] font-medium"> / {s.inv}</span>
            </div>
            <div className="text-xs text-[var(--muted)]">
              {s.att} attente · {s.non} absents
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <input className="flex-1 min-w-[160px]" placeholder="Rechercher" value={gSearch} onChange={(e) => setGSearch(e.target.value)} />
        <select value={gFGroup} onChange={(e) => setGFGroup(e.target.value)}>
          <option value="">Tous les groupes</option>
          {GUEST_GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        {canEdit && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              const next = { ...B };
              stats.forEach((s) => {
                if (s.e === "tef") next.gTef = s.inv - s.non;
                if (s.e === "dej") next.gDej = s.inv - s.non;
                if (s.e === "soir") next.guests = s.inv - s.non;
              });
              setB(next);
              persistBudget();
            }}
          >
            Reporter dans le budget
          </button>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-[var(--muted)]">
              <th className="p-2">Nom</th>
              <th className="p-2">Groupe</th>
              {EVS.map(([e, lab]) => (
                <th key={e} className="p-2">
                  {lab}
                </th>
              ))}
              <th className="p-2">Table</th>
              <th className="p-2">Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const x = G[id];
              return (
                <tr key={id} className="border-t border-[var(--line)]">
                  <td className="p-2">
                    <input
                      disabled={!canEdit}
                      value={x.nom}
                      onChange={(e) => {
                        x.nom = e.target.value;
                        setG({ ...G });
                        persistGuest(id, x);
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      disabled={!canEdit}
                      value={x.groupe}
                      onChange={(e) => {
                        x.groupe = e.target.value;
                        setG({ ...G });
                        persistGuest(id, x);
                      }}
                    >
                      {GUEST_GROUPS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </td>
                  {EVS.map(([e]) => {
                    const v = x.inv?.[e] || "";
                    return (
                      <td key={e} className="p-2">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            className="w-14"
                            disabled={!canEdit || !v}
                            value={v ? pers(x, e) : ""}
                            onChange={(ev) => {
                              x.n = x.n || {};
                              x.n[e] = +ev.target.value || 0;
                              setG({ ...G });
                              persistGuest(id, x);
                            }}
                          />
                          <select
                            disabled={!canEdit}
                            value={v}
                            onChange={(ev) => {
                              x.inv = x.inv || {};
                              x.inv[e] = ev.target.value as GuestData["inv"][string];
                              if (ev.target.value && !(+(x.n?.[e] || 0) > 0)) {
                                x.n = x.n || {};
                                x.n[e] = 2;
                              }
                              setG({ ...G });
                              persistGuest(id, x);
                            }}
                          >
                            <option value="">Non invité</option>
                            <option value="att">Attente</option>
                            <option value="oui">Présent</option>
                            <option value="non">Absent</option>
                          </select>
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2">
                    <input
                      className="w-16"
                      disabled={!canEdit}
                      value={x.table}
                      onChange={(e) => {
                        x.table = e.target.value;
                        setG({ ...G });
                        persistGuest(id, x);
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      disabled={!canEdit}
                      value={x.note}
                      onChange={(e) => {
                        x.note = e.target.value;
                        setG({ ...G });
                        persistGuest(id, x);
                      }}
                    />
                  </td>
                  <td className="p-2">
                    {canEdit && (
                      <button
                        className="text-[var(--vire)]"
                        onClick={() => {
                          const n = { ...G };
                          delete n[id];
                          setG(n);
                          persistGuest(id, null);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="card p-4 mt-3 grid gap-2">
          <b>Ajouter</b>
          <div className="flex flex-wrap gap-2">
            <input placeholder="Nom du foyer" value={nom} onChange={(e) => setNom(e.target.value)} />
            <input type="number" className="w-20" value={nb} onChange={(e) => setNb(+e.target.value || 0)} />
            <select value={grp} onChange={(e) => setGrp(e.target.value)}>
              {GUEST_GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <select value={form} onChange={(e) => setForm(e.target.value)}>
              <option value="all">Invité partout</option>
              <option value="soir">Soirée seulement</option>
              <option value="tef">Tefilin seulement</option>
              <option value="tef+soir">Tefilin + soirée</option>
              <option value="tef+dej+soir">Tefilin + syna + soirée</option>
            </select>
            <button
              className="btn"
              onClick={() => {
                if (!nom.trim()) return;
                addGuest(nom.trim(), nb, grp, form);
                setNom("");
              }}
            >
              Ajouter
            </button>
          </div>
          <details>
            <summary className="cursor-pointer text-[var(--tekhelet)] font-semibold">Coller un tableau (famille · syna · soirée)</summary>
            <textarea className="w-full mt-2" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button
              className="btn mt-2"
              onClick={() => {
                const three = paste.split(/\r?\n/).some((l) => l.split(/\t|;/).length >= 3);
                paste.split(/\r?\n/).forEach((l) => {
                  if (!l.trim()) return;
                  const p = l.split(/\t|;/).map((s) => s.trim());
                  const name = p[0];
                  if (!name) return;
                  const nums = p.slice(1).map((v) => (v === "" ? 0 : Number(v.replace(",", "."))));
                  if (p.length > 1 && p.slice(1).some((v) => v !== "" && isNaN(Number(v.replace(",", "."))))) return;
                  if (three) addGuest(name, 0, grp, form, { tef: 0, dej: nums[0] || 0, soir: nums[1] || 0 });
                  else addGuest(name, p.length > 1 ? nums[0] || 0 : 2, grp, form);
                });
                setPaste("");
              }}
            >
              Ajouter la liste
            </button>
          </details>
        </div>
      )}
    </section>
  );
}
