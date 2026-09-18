"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FR_CITIES } from "@/lib/cities";
import { VENDOR_LABELS, type Vendor, type VendorCategory } from "@/lib/types";
import { normalizeWebsite, vendorPageHref } from "@/lib/vendors";
import VendorLogo from "@/components/vendors/VendorLogo";
import Link from "next/link";
import { Suspense } from "react";

const CATS = Object.keys(VENDOR_LABELS) as VendorCategory[];

function VendorInner() {
  const sp = useSearchParams();
  const claimId = sp.get("claim");
  const [vendor, setVendor] = useState<Partial<Vendor>>({
    name: "",
    categories: [],
    city: "Paris",
    radius_km: 30,
    kasherut: "casher",
    description: "",
    website: "",
    phone: "",
    logo_url: "",
  });
  const [claimables, setClaimables] = useState<Vendor[]>([]);
  const [status, setStatus] = useState<string>("none");
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = createClient();
    (async () => {
      const { data: u } = await sb.auth.getUser();
      setEmail(u.user?.email || "");
      if (!u.user) return;
      await sb.from("profiles").update({ role: "vendor" }).eq("id", u.user.id);
      const { data } = await sb.from("vendors").select("*").eq("user_id", u.user.id).maybeSingle();
      if (data) {
        setVendor(data as Vendor);
        const { data: sub } = await sb.from("subscriptions").select("status").eq("vendor_id", data.id).maybeSingle();
        setStatus(sub?.status || "none");
      } else {
        const { data: free } = await sb.from("vendors").select("*").is("user_id", null).order("name");
        setClaimables((free || []) as Vendor[]);
        if (claimId) {
          const { error } = await sb.from("vendors").update({ user_id: u.user.id }).eq("id", claimId).is("user_id", null);
          if (!error) {
            const { data: claimed } = await sb.from("vendors").select("*").eq("id", claimId).single();
            if (claimed) {
              setVendor(claimed as Vendor);
              setClaimables([]);
              setMsg("Fiche revendiquée. Ajoutez votre logo et l’URL de votre site, puis enregistrez.");
              return;
            }
          }
          const row = (free || []).find((v: Vendor) => v.id === claimId);
          if (row) setVendor(row as Vendor);
        }
      }
    })();
  }, [claimId]);

  async function claim(id: string) {
    setBusy(true);
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    const { error } = await sb.from("vendors").update({ user_id: u.user.id }).eq("id", id).is("user_id", null);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    const { data } = await sb.from("vendors").select("*").eq("id", id).single();
    if (data) {
      setVendor(data as Vendor);
      setClaimables([]);
      setMsg("Fiche revendiquée. Vous pouvez maintenant modifier le logo, le site et les coordonnées.");
    }
  }

  async function uploadLogo(file: File) {
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${u.user.id}/logo.${ext}`;
    const { error } = await sb.storage.from("vendor-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setMsg("Logo : " + error.message);
      return;
    }
    const { data } = sb.storage.from("vendor-assets").getPublicUrl(path);
    setVendor((v) => ({ ...v, logo_url: `${data.publicUrl}?t=${Date.now()}` }));
    setMsg("Logo ajouté. Enregistrez la fiche pour le publier.");
  }

  async function save() {
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    if (!vendor.name?.trim()) {
      setMsg("Indiquez le nom de l’enseigne.");
      return;
    }
    setBusy(true);
    const city = FR_CITIES.find((c) => c.name === vendor.city);
    const payload = {
      user_id: u.user.id,
      name: vendor.name.trim(),
      categories: vendor.categories || [],
      city: vendor.city,
      lat: city?.lat ?? null,
      lng: city?.lng ?? null,
      radius_km: vendor.radius_km || 30,
      kasherut: vendor.kasherut,
      price_min: vendor.price_min || null,
      price_max: vendor.price_max || null,
      description: vendor.description,
      website: normalizeWebsite(vendor.website),
      phone: vendor.phone,
      logo_url: vendor.logo_url || null,
      free_listing: true,
      moderated: true,
    };
    const { error } = vendor.id
      ? await sb.from("vendors").update(payload).eq("id", vendor.id)
      : await sb.from("vendors").insert(payload);
    setBusy(false);
    setMsg(error ? error.message : "Fiche publiée sur l’annuaire.");
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
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">Espace prestataire</p>
          <h1 className="text-3xl">Votre page Simha</h1>
          <p className="text-sm text-[var(--muted)]">{email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/prestataires" className="btn btn-ghost">
            Annuaire
          </Link>
          {vendor.id && (
            <Link href={vendorPageHref(vendor.id)} className="btn">
              Voir ma page publique
            </Link>
          )}
        </div>
      </div>

      {!vendor.user_id && claimables.length > 0 && (
        <div className="card p-5 mt-6">
          <h2 className="text-xl">Revendiquer une fiche existante</h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Si votre enseigne est déjà dans l’annuaire, prenez-en le contrôle pour ajouter logo et site.
          </p>
          <select
            className="mt-3 w-full"
            value={vendor.id && claimables.some((c) => c.id === vendor.id) ? vendor.id : ""}
            onChange={(e) => {
              const row = claimables.find((c) => c.id === e.target.value);
              if (row) setVendor(row);
              else
                setVendor({
                  name: "",
                  categories: [],
                  city: "Paris",
                  radius_km: 30,
                  kasherut: "casher",
                  description: "",
                  website: "",
                  phone: "",
                  logo_url: "",
                });
            }}
          >
            <option value="">Créer une nouvelle fiche…</option>
            {claimables.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.city}
              </option>
            ))}
          </select>
          {vendor.id && claimables.some((c) => c.id === vendor.id) && (
            <button className="btn mt-3" disabled={busy} onClick={() => claim(vendor.id as string)}>
              Revendiquer cette fiche
            </button>
          )}
        </div>
      )}

      <div className="card p-5 mt-4 grid gap-3">
        <div className="flex gap-4 items-center">
          <VendorLogo vendor={{ name: vendor.name || "Prestataire", logo_url: vendor.logo_url || null }} size={80} />
          <label className="text-sm">
            Logo
            <input
              className="block mt-1"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLogo(f);
              }}
            />
          </label>
        </div>
        <label>Enseigne</label>
        <input value={vendor.name || ""} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} />
        <label>Ville</label>
        <select value={vendor.city || "Paris"} onChange={(e) => setVendor({ ...vendor, city: e.target.value })}>
          {FR_CITIES.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
        <label>Rayon d’intervention (km)</label>
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
        <label>Présentation</label>
        <textarea rows={4} value={vendor.description || ""} onChange={(e) => setVendor({ ...vendor, description: e.target.value })} />
        <label>URL du site</label>
        <input
          type="text"
          inputMode="url"
          placeholder="https://www.exemple.fr"
          value={vendor.website || ""}
          onChange={(e) => setVendor({ ...vendor, website: e.target.value })}
        />
        <label>Téléphone</label>
        <input value={vendor.phone || ""} onChange={(e) => setVendor({ ...vendor, phone: e.target.value })} />
        <button className="btn" disabled={busy} onClick={save}>
          Publier / enregistrer
        </button>
        <p className="text-sm text-[var(--muted)]">
          Abonnement partenaire (optionnel) : {status === "active" || status === "trialing" ? "actif" : "non souscrit"}.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-gold" onClick={checkout}>
            Badge partenaire (mensuel)
          </button>
          <button className="btn btn-ghost" onClick={portal}>
            Gérer l’abonnement
          </button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </div>
  );
}

export default function VendorPage() {
  return (
    <Suspense>
      <VendorInner />
    </Suspense>
  );
}
