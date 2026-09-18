export const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (d?: string | null) =>
  d
    ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "Sans date";

export const fmtLong = (d?: string | null) =>
  d
    ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

export function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function countdown(iso?: string | null) {
  if (!iso) return "";
  const n = Math.ceil((new Date(iso + "T09:00:00").getTime() - Date.now()) / 864e5);
  if (n > 0) return `J-${n}`;
  if (n === 0) return "C’est aujourd’hui";
  return "Passé";
}
