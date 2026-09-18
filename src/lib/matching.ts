import type { EventRow, Vendor } from "@/lib/types";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function vendorMatches(v: Vendor, event: EventRow, category?: string) {
  if (category && !v.categories.includes(category)) return false;
  if (event.kosher === "casher_glatt" && v.kasherut === "non_casher") return false;
  if (event.kosher === "casher" && v.kasherut === "non_casher") return false;
  const envelope = event.budget_envelope;
  if (envelope && v.price_min && v.price_min > envelope) return false;
  if (event.lat != null && event.lng != null && v.lat != null && v.lng != null) {
    const d = haversineKm({ lat: event.lat, lng: event.lng }, { lat: v.lat, lng: v.lng });
    if (d > (v.radius_km || 30)) return false;
    return { ...v, distanceKm: Math.round(d) };
  }
  if (event.city && v.city && event.city.toLowerCase() !== v.city.toLowerCase()) {
    return false;
  }
  return { ...v, distanceKm: null as number | null };
}

export function rankVendors(vendors: Vendor[], event: EventRow, category?: string) {
  return vendors
    .map((v) => vendorMatches(v, event, category))
    .filter(Boolean) as (Vendor & { distanceKm: number | null })[];
}
