export type HebcalItem = {
  title: string;
  date: string;
  hdate?: string;
  category: string;
  subcat?: string;
  hebrew?: string;
  memo?: string;
  leyning?: { torah?: string; haftarah?: string };
};

export type CalendarReading = {
  items: HebcalItem[];
  parasha?: HebcalItem;
  candles?: HebcalItem;
  havdalah?: HebcalItem;
  holidays: HebcalItem[];
  omer: HebcalItem[];
  warnings: string[];
};

function hebcalUrl(params: Record<string, string>) {
  const u = new URL("https://www.hebcal.com/hebcal");
  Object.entries({ v: "1", cfg: "json", lg: "fr", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

export async function convertToHebrew(iso: string) {
  const [gy, gm, gd] = iso.split("-");
  const u = `https://www.hebcal.com/converter?cfg=json&gy=${gy}&gm=${gm}&gd=${gd}&g2h=1`;
  const r = await fetch(u, { next: { revalidate: 86400 } });
  if (!r.ok) throw new Error("Conversion de date impossible");
  return (await r.json()) as { hy: number; hm: string; hd: number; hebrew: string; events?: string[] };
}

export async function fetchRange(opts: {
  start: string;
  end: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const params: Record<string, string> = {
    start: opts.start,
    end: opts.end,
    maj: "on",
    min: "on",
    nx: "on",
    mf: "on",
    ss: "on",
    s: "on",
    o: "on",
    M: "on",
  };
  if (opts.lat != null && opts.lng != null) {
    params.c = "on";
    params.geo = "pos";
    params.latitude = String(opts.lat);
    params.longitude = String(opts.lng);
    params.tzid = "Europe/Paris";
    params.b = "18";
  }
  const r = await fetch(hebcalUrl(params), { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error("Calendrier juif indisponible");
  const json = (await r.json()) as { items?: HebcalItem[] };
  return json.items || [];
}

export function analyze(items: HebcalItem[]): CalendarReading {
  const parasha = items.find((i) => i.category === "parashat");
  const candles = items.find((i) => i.category === "candles");
  const havdalah = items.find((i) => i.category === "havdalah");
  const holidays = items.filter((i) => i.category === "holiday");
  const omer = items.filter((i) => /omer/i.test(i.title) || i.category === "omer");
  const warnings: string[] = [];
  if (omer.length) {
    warnings.push("Période du Omer : selon la coutume, pas de musique live ni de célébration ostentatoire avant Lag BaOmer. La soirée est plus souple après Lag BaOmer. À valider avec votre rabbin.");
  }
  if (holidays.some((h) => /pessa|pesach|passover/i.test(h.title))) {
    warnings.push("Pessa’h est proche : bouclez un maximum avant, les prestataires casher sont saturés.");
  }
  if (holidays.some((h) => /roch.?hodech|rosh chodesh/i.test(h.title))) {
    warnings.push("Roch ’Hodech : haftara spécifique. À caler avec le professeur de l’enfant.");
  }
  if (holidays.some((h) => /9 av|tisha|jeûne|fast/i.test(h.title))) {
    warnings.push("Un jeûne ou une période de deuil (3 semaines / 9 Av) tombe autour de cette date : célébrations limitées.");
  }
  warnings.push("Les horaires de nérot et de havdalah viennent de Hebcal, pas du modèle de langage. Confirmez avec votre synagogue.");
  return { items, parasha, candles, havdalah, holidays, omer, warnings };
}

export async function readingForDate(iso: string, lat?: number | null, lng?: number | null) {
  const start = iso;
  const endDate = new Date(iso + "T12:00:00");
  endDate.setDate(endDate.getDate() + 2);
  const end = endDate.toISOString().slice(0, 10);
  const items = await fetchRange({ start, end, lat, lng });
  return analyze(items);
}

export async function hebrewBirthday(birthIso: string, years: number) {
  const u = `https://www.hebcal.com/yahrzeit?cfg=json&v=y&n=enfant&y=${birthIso.slice(0, 4)}&m=${birthIso.slice(5, 7)}&d=${birthIso.slice(8, 10)}&hebdate=on&years=${years + 2}`;
  const r = await fetch(u, { next: { revalidate: 86400 } });
  if (!r.ok) return null;
  const json = (await r.json()) as { items?: { title: string; date: string; hdate?: string }[] };
  return json.items || [];
}
