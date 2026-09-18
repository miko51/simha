import type { Vendor, VendorCategory } from "@/lib/types";
import { VENDOR_LABELS } from "@/lib/types";

export function normalizeWebsite(raw?: string | null): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return "https://" + s.replace(/^\/\//, "");
}

export function vendorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "S";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}

export function directoryHref(cat?: VendorCategory | "" | null, city?: string | null) {
  const q = new URLSearchParams();
  if (cat) q.set("cat", cat);
  if (city) q.set("city", city);
  const s = q.toString();
  return s ? `/prestataires?${s}` : "/prestataires";
}

export function vendorPageHref(id: string) {
  return `/prestataires/${id}`;
}

export function categoryLabel(cat: string) {
  return VENDOR_LABELS[cat as VendorCategory] || cat;
}

export function sortVendorsForCity(vendors: Vendor[], city?: string | null) {
  if (!city) return vendors;
  const c = city.toLowerCase();
  return [...vendors].sort((a, b) => {
    const aHit = (a.city || "").toLowerCase() === c ? 0 : 1;
    const bHit = (b.city || "").toLowerCase() === c ? 0 : 1;
    return aHit - bHit || a.name.localeCompare(b.name, "fr");
  });
}
