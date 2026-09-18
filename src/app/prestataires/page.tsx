import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import VendorCard from "@/components/vendors/VendorCard";
import { VENDOR_LABELS, type Vendor, type VendorCategory } from "@/lib/types";
import { directoryHref, sortVendorsForCity } from "@/lib/vendors";

export const dynamic = "force-dynamic";

export default async function PrestatairesPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; city?: string }>;
}) {
  const { cat, city } = await searchParams;
  const active = (Object.keys(VENDOR_LABELS) as VendorCategory[]).includes(cat as VendorCategory)
    ? (cat as VendorCategory)
    : "";
  const sb = await createClient();
  const { data } = await sb.from("vendors").select("*").order("name");
  let vendors = (data || []) as Vendor[];
  if (active) vendors = vendors.filter((v) => v.categories?.includes(active));
  vendors = sortVendorsForCity(vendors, city || null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <SiteHeader current="directory" />
      <section className="mt-12">
        <p className="eyebrow">Annuaire</p>
        <h1 className="text-4xl mt-2">Prestataires bar &amp; bat mitzvah</h1>
        <p className="text-[var(--muted)] mt-3 max-w-2xl">
          Pages publiques : coordonnées, logo et site. Les professionnels créent un compte pour
          revendiquer ou publier leur fiche.
        </p>
        <Link href="/login?role=vendor&next=/vendor" className="btn btn-gold mt-5 inline-flex">
          Créer / gérer ma page
        </Link>
      </section>

      <div className="flex flex-wrap gap-2 mt-8">
        <Link href={directoryHref("", city)} className={`btn ${active ? "btn-ghost" : ""}`}>
          Toutes
        </Link>
        {(Object.keys(VENDOR_LABELS) as VendorCategory[]).map((c) => (
          <Link key={c} href={directoryHref(c, city)} className={`btn ${active === c ? "" : "btn-ghost"}`}>
            {VENDOR_LABELS[c]}
          </Link>
        ))}
      </div>
      {city ? (
        <p className="text-sm text-[var(--muted)] mt-3">
          Ville de l’événement : <b>{city}</b>{" "}
          <Link href={directoryHref(active, null)} className="text-[var(--tekhelet)]">
            (voir partout)
          </Link>
        </p>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3 mt-6">
        {vendors.length === 0 && (
          <p className="text-[var(--muted)]">Aucun prestataire dans ce filtre pour l’instant.</p>
        )}
        {vendors.map((v) => (
          <VendorCard key={v.id} vendor={v} />
        ))}
      </div>
    </div>
  );
}
