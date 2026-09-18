import Link from "next/link";
import VendorLogo from "@/components/vendors/VendorLogo";
import { categoryLabel, normalizeWebsite, vendorPageHref } from "@/lib/vendors";
import { eur } from "@/lib/money";
import type { Vendor } from "@/lib/types";

export default function VendorCard({ vendor }: { vendor: Vendor & { distanceKm?: number | null } }) {
  const site = normalizeWebsite(vendor.website);
  return (
    <article className="card p-4 flex gap-3">
      <VendorLogo vendor={vendor} size={64} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={vendorPageHref(vendor.id)} className="font-bold hover:text-[var(--tekhelet)]">
            {vendor.name}
          </Link>
          <span className="chip bg-[var(--gold-soft)] text-[var(--gold)] shrink-0">
            {vendor.free_listing && !vendor.user_id ? "Gratuit" : vendor.user_id ? "Fiche active" : "Partenaire"}
          </span>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {(vendor.categories || []).map(categoryLabel).join(" · ")}
          {vendor.city ? ` · ${vendor.city}` : ""}
          {vendor.distanceKm != null ? ` · ${vendor.distanceKm} km` : ""}
        </p>
        {vendor.description ? <p className="text-sm mt-2 line-clamp-3">{vendor.description}</p> : null}
        <p className="text-sm mt-1">
          {vendor.price_min ? `À partir de ${eur(vendor.price_min)}` : ""}
          {vendor.kasherut ? ` · ${vendor.kasherut.replace(/_/g, " ")}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href={vendorPageHref(vendor.id)} className="font-semibold text-[var(--tekhelet)]">
            Voir la page
          </Link>
          {vendor.phone && (
            <a className="text-[var(--tekhelet)]" href={`tel:${vendor.phone.replace(/\s/g, "")}`}>
              {vendor.phone}
            </a>
          )}
          {site && (
            <a className="text-[var(--tekhelet)]" href={site} target="_blank" rel="noreferrer">
              Site
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
