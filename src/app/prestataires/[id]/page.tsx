import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import VendorLogo from "@/components/vendors/VendorLogo";
import { VENDOR_LABELS, type Vendor, type VendorCategory } from "@/lib/types";
import { categoryLabel, directoryHref, normalizeWebsite } from "@/lib/vendors";
import { eur } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PrestatairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data } = await sb.from("vendors").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const v = data as Vendor;
  const {
    data: { user },
  } = await sb.auth.getUser();
  const mine = !!(user && v.user_id === user.id);
  const site = normalizeWebsite(v.website);
  const unclaimed = !v.user_id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <SiteHeader current="directory" />
      <p className="mt-10">
        <Link href={directoryHref((v.categories?.[0] as VendorCategory) || "", v.city)} className="text-sm text-[var(--tekhelet)]">
          ← Retour à l’annuaire
          {v.categories?.[0] ? ` · ${categoryLabel(v.categories[0])}` : ""}
        </Link>
      </p>
      <article className="card p-6 mt-4">
        <div className="flex gap-4 items-start">
          <VendorLogo vendor={v} size={96} />
          <div className="min-w-0">
            <p className="eyebrow">{unclaimed ? "Fiche à revendiquer" : "Page prestataire"}</p>
            <h1 className="text-3xl mt-1">{v.name}</h1>
            <p className="text-[var(--muted)] mt-1">
              {(v.categories || []).map((c) => VENDOR_LABELS[c as VendorCategory] || c).join(" · ")}
              {v.city ? ` · ${v.city}` : ""}
              {v.radius_km ? ` · ${v.radius_km} km` : ""}
            </p>
          </div>
        </div>
        {v.description ? <p className="mt-5 leading-relaxed">{v.description}</p> : null}
        <dl className="grid sm:grid-cols-2 gap-3 mt-6 text-sm">
          {v.kasherut && (
            <div>
              <dt className="text-[var(--muted)]">Kasherut</dt>
              <dd className="font-semibold">{v.kasherut.replace(/_/g, " ")}</dd>
            </div>
          )}
          {(v.price_min || v.price_max) && (
            <div>
              <dt className="text-[var(--muted)]">Tarifs indicatifs</dt>
              <dd className="font-semibold">
                {v.price_min ? `À partir de ${eur(v.price_min)}` : ""}
                {v.price_min && v.price_max ? " · " : ""}
                {v.price_max ? `jusqu’à ${eur(v.price_max)}` : ""}
              </dd>
            </div>
          )}
          {v.phone && (
            <div>
              <dt className="text-[var(--muted)]">Téléphone</dt>
              <dd>
                <a className="font-semibold text-[var(--tekhelet)]" href={`tel:${v.phone.replace(/\s/g, "")}`}>
                  {v.phone}
                </a>
              </dd>
            </div>
          )}
          {site && (
            <div>
              <dt className="text-[var(--muted)]">Site web</dt>
              <dd>
                <a className="font-semibold text-[var(--tekhelet)]" href={site} target="_blank" rel="noreferrer">
                  {site.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap gap-3 mt-6">
          {v.phone && (
            <a className="btn" href={`tel:${v.phone.replace(/\s/g, "")}`}>
              Appeler
            </a>
          )}
          {site && (
            <a className="btn btn-ghost" href={site} target="_blank" rel="noreferrer">
              Ouvrir le site
            </a>
          )}
          {mine && (
            <Link href="/vendor" className="btn btn-gold">
              Modifier ma fiche
            </Link>
          )}
          {unclaimed && !mine && (
            <Link href={`/login?role=vendor&next=${encodeURIComponent("/vendor?claim=" + v.id)}`} className="btn btn-gold">
              C’est moi — créer un compte et gérer cette page
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
