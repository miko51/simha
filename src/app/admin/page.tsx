"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Synagogue, Vendor } from "@/lib/types";

export default function AdminPage() {
  const sb = createClient();
  const [ok, setOk] = useState<boolean | null>(null);
  const [synas, setSynas] = useState<Synagogue[]>([]);
  const [vendors, setVendors] = useState<(Vendor & { listed?: boolean })[]>([]);
  const [subs, setSubs] = useState<{ vendor_id: string; status: string }[]>([]);
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; city: string; notes: string | null; status: string }[]>([]);
  const [form, setForm] = useState({ name: "", city: "", rite: "sepharade", address: "", notes: "" });
  const [hall, setHall] = useState({ synagogue_id: "", name: "", capacity: "100", usage: "polyvalent" });
  const [csv, setCsv] = useState("name,city,address,rite,hall,capacity,usage\n");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return;
      const { data: p } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
      if (p?.role !== "admin") {
        setOk(false);
        return;
      }
      setOk(true);
      const [s, v, sub, sug] = await Promise.all([
        sb.from("synagogues").select("*").order("city"),
        sb.from("vendors").select("*"),
        sb.from("subscriptions").select("vendor_id,status"),
        sb.from("synagogue_suggestions").select("*").eq("status", "pending"),
      ]);
      setSynas((s.data as Synagogue[]) || []);
      setVendors((v.data as Vendor[]) || []);
      setSubs((sub.data as { vendor_id: string; status: string }[]) || []);
      setSuggestions((sug.data as typeof suggestions) || []);
    })();
  }, [sb]);

  if (ok === false)
    return (
      <div className="p-8">
        Accès admin refusé. Passez votre profil en admin dans Supabase (<code>profiles.role = admin</code>).
      </div>
    );
  if (ok === null) return <div className="p-8">Chargement…</div>;

  async function addSyn() {
    const { error } = await sb.from("synagogues").insert({ ...form, status: "approved" });
    setMsg(error ? error.message : "Synagogue ajoutée.");
    const { data } = await sb.from("synagogues").select("*").order("city");
    setSynas((data as Synagogue[]) || []);
  }
  async function addHall() {
    const { error } = await sb.from("halls").insert({
      synagogue_id: hall.synagogue_id,
      name: hall.name,
      capacity: +hall.capacity || 0,
      usage: hall.usage,
    });
    setMsg(error ? error.message : "Salle ajoutée.");
  }
  async function importCsv() {
    const r = await fetch("/api/admin/synagogues/import", { method: "POST", body: csv });
    const j = await r.json();
    setMsg(j.error || `${j.imported} lignes importées`);
  }
  async function approve(id: string, name: string, city: string, notes: string | null) {
    await sb.from("synagogues").insert({ name, city, notes, status: "approved" });
    await sb.from("synagogue_suggestions").update({ status: "approved" }).eq("id", id);
    setSuggestions((s) => s.filter((x) => x.id !== id));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex justify-between">
        <h1 className="text-3xl">Administration Simha</h1>
        <Link href="/app" className="btn btn-ghost">
          App
        </Link>
      </div>
      {msg && <p className="mt-3 text-sm">{msg}</p>}

      <section className="card p-4 mt-6 grid gap-2">
        <h2 className="text-xl">Nouvelle synagogue</h2>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Ville" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <select value={form.rite} onChange={(e) => setForm({ ...form, rite: e.target.value })}>
          <option value="sepharade">Séfarade</option>
          <option value="ashkenaze">Ashkénaze</option>
          <option value="massorti">Massorti</option>
          <option value="autre">Autre</option>
        </select>
        <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="btn" onClick={addSyn}>
          Ajouter
        </button>
      </section>

      <section className="card p-4 mt-4 grid gap-2">
        <h2 className="text-xl">Salle / contenance</h2>
        <select value={hall.synagogue_id} onChange={(e) => setHall({ ...hall, synagogue_id: e.target.value })}>
          <option value="">Choisir une synagogue</option>
          {synas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.city})
            </option>
          ))}
        </select>
        <input placeholder="Nom de la salle" value={hall.name} onChange={(e) => setHall({ ...hall, name: e.target.value })} />
        <input type="number" value={hall.capacity} onChange={(e) => setHall({ ...hall, capacity: e.target.value })} />
        <select value={hall.usage} onChange={(e) => setHall({ ...hall, usage: e.target.value })}>
          <option value="office">Office</option>
          <option value="kiddouch">Kiddouch</option>
          <option value="repas">Repas</option>
          <option value="polyvalent">Polyvalent</option>
        </select>
        <button className="btn" onClick={addHall}>
          Ajouter la salle
        </button>
      </section>

      <section className="card p-4 mt-4">
        <h2 className="text-xl">Import CSV</h2>
        <p className="text-sm text-[var(--muted)]">Colonnes : name, city, address, rite, hall, capacity, usage</p>
        <textarea rows={6} className="w-full mt-2" value={csv} onChange={(e) => setCsv(e.target.value)} />
        <button className="btn mt-2" onClick={importCsv}>
          Importer
        </button>
      </section>

      <section className="mt-6">
        <h2 className="text-xl">Annuaire ({synas.length})</h2>
        <ul className="text-sm mt-2 grid gap-1">
          {synas.map((s) => (
            <li key={s.id}>
              {s.name} — {s.city} ({s.rite})
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl">Suggestions familles</h2>
        {suggestions.length === 0 && <p className="text-sm text-[var(--muted)]">Aucune.</p>}
        {suggestions.map((s) => (
          <div key={s.id} className="card p-3 mt-2 flex justify-between">
            <div>
              <b>{s.name}</b> · {s.city}
              <div className="text-sm">{s.notes}</div>
            </div>
            <button className="btn" onClick={() => approve(s.id, s.name, s.city, s.notes)}>
              Approuver
            </button>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <h2 className="text-xl">Prestataires</h2>
        {vendors.map((v) => {
          const st = subs.find((s) => s.vendor_id === v.id)?.status || "sans abo";
          return (
            <div key={v.id} className="card p-3 mt-2">
              <b>{v.name}</b> · {v.city} · {st}
              <div className="text-sm text-[var(--muted)]">{(v.categories || []).join(", ")}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
