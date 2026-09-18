"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FR_CITIES } from "@/lib/cities";
import { VENDOR_LABELS, type Vendor, type VendorCategory } from "@/lib/types";
import Link from "next/link";

const CATS = Object.keys(VENDOR_LABELS) as VendorCategory[];

export default function VendorPage() {
  const sb = createClient();
  const [vendor, setVendor] = useState<Partial<Vendor>>({
    name: "",
    categories: [],
    city: "Paris",
    radius_km: 30,
    kasherut: "casher",
    description: "",
    website: "",
    phone: "",
  });
  const [status, setStatus] = useState<string>("none");
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await sb.auth.getUser();
      setEmail(u.user?.email || "");
      if (!u.user) return;
      await sb.from("profiles").update({ role: "vendor" }).eq("id", u.user.id);
      const { data } = await sb.from("vendors").select("*").eq("user_id", u.user.id).maybeSingle();
      if (data) setVendor(data as Vendor);
      if (data) {
        const { data: sub } = await sb.from("subscriptions").select("status").eq("vendor_id", data.id).maybeSingle();
        setStatus(sub?.status || "none");
      }
    })();
  }, [sb]);

  async function save() {
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    const city = FR_CITIES.find((c) => c.name === vendor.city);
    const payload = {
      user_id: u.user.id,
      name: vendor.name,
      categories: vendor.categories || [],
      city: vendor.city,
      lat: city?.lat,
      lng: city?.lng,
      radius_km: vendor.radius_km || 30,
      kasherut: vendor.kasherut,
      price_min: vendor.price_min || null,
      price_max: vendor.price_max || null,
      description: vendor.description,
      website: vendor.website,
      phone: vendor.phone,
    };
    const { error } = vendor.id
      ? await sb.from("vendors").update(payload).eq("id", vendor.id)
      : await sb.from("vendors").insert(payload);
    setMsg(error ? error.message : "Fiche enregistrée.");
    if (!error && !vendor.id) {
      const { data } = await sb.from("vendors").select("*").eq("user_id", u.user.id).single();
      if (data) setVendor(data as Vendor);
    }
  }

  async function checkout() {
    const r = await fetch("/api/stripe/checkout", { method: "POST" });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else setMsg(j.error || "Checkout impossible");
  }

  async function portal() {
    const r = await fetch("/api/stripe/portal", { method: "POST" });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else setMsg(j.error || "Portail impossible");
  }

  function toggle(cat: VendorCategory) {
    const cur = new Set(vendor.categories || []);
    if (cur.has(cat)) cur.delete(cat);
    else cur.add(cat);
    setVendor({ ...vendor, categories: [...cur] });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex justify-between">
        <div>
          <p className="eyebrow">Prestataires</p>
          <h1 className="text-3xl">Votre fiche Simha</h1>
          <p className="text-sm text-[var(--muted)]">{email}</p>
        </div>
        <Link href="/" className="btn btn-ghost">
          Accueil
        </Link>
      </div>
      <p className="mt-4 text-sm">
        Abonnement : <b>{status === "active" || status === "trialing" ? "visible dans l’annuaire" : "invisible tant que l’abonnement n’est pas actif"}</b>
      </p>
      <div className="card p-5 mt-4 grid gap-3">
        <label>Enseigne</label>
        <input value={vendor.name || ""} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} />
        <label>Ville</label>
        <select value={vendor.city || "Paris"} onChange={(e) => setVendor({ ...vendor, city: e.target.value })}>
          {FR_CITIES.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
        <label>Rayon (km)</label>
        <input type="number" value={vendor.radius_km || 30} onChange={(e) => setVendor({ ...vendor, radius_km: +e.target.value || 30 })} />
        <label>Catégories</label>
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button key={c} type="button" className={`btn ${(vendor.categories || []).includes(c) ? "" : "btn-ghost"}`} onClick={() => toggle(c)}>
              {VENDOR_LABELS[c]}
            </button>
          ))}
        </div>
        <label>Kasherut</label>
        <select value={vendor.kasherut || "casher"} onChange={(e) => setVendor({ ...vendor, kasherut: e.target.value })}>
          <option value="casher">Casher</option>
          <option value="casher_glatt">Casher glatt</option>
          <option value="flexible">Flexible</option>
          <option value="non_casher">Non casher</option>
        </select>
        <label>Prix min / max (€)</label>
        <div className="flex gap-2">
          <input type="number" value={vendor.price_min || ""} onChange={(e) => setVendor({ ...vendor, price_min: +e.target.value || null })} />
          <input type="number" value={vendor.price_max || ""} onChange={(e) => setVendor({ ...vendor, price_max: +e.target.value || null })} />
        </div>
        <label>Description</label>
        <textarea rows={4} value={vendor.description || ""} onChange={(e) => setVendor({ ...vendor, description: e.target.value })} />
        <label>Site</label>
        <input value={vendor.website || ""} onChange={(e) => setVendor({ ...vendor, website: e.target.value })} />
        <label>Téléphone</label>
        <input value={vendor.phone || ""} onChange={(e) => setVendor({ ...vendor, phone: e.target.value })} />
        <button className="btn" onClick={save}>
          Enregistrer la fiche
        </button>
        <button className="btn btn-gold" onClick={checkout}>
          S’abonner (mensuel) pour apparaître
        </button>
        <button className="btn btn-ghost" onClick={portal}>
          Gérer l’abonnement
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </div>
  );
}
