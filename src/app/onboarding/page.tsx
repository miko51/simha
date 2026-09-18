"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FR_CITIES } from "@/lib/cities";
import type { CalendarReading, HebcalItem } from "@/lib/hebcal";
import type { Synagogue } from "@/lib/types";

type Step = 0 | 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [kind, setKind] = useState<"bar" | "bat">("bar");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [birth, setBirth] = useState("");
  const [city, setCity] = useState("Paris");
  const [minhag, setMinhag] = useState("sepharade");
  const [kosher, setKosher] = useState("casher");
  const [synagogueId, setSynagogueId] = useState("");
  const [synas, setSynas] = useState<Synagogue[]>([]);
  const [q, setQ] = useState("");
  const [dateTef, setDateTef] = useState("");
  const [dateShab, setDateShab] = useState("");
  const [dateParty, setDateParty] = useState("");
  const [envelope, setEnvelope] = useState("80000");
  const [reading, setReading] = useState<CalendarReading | null>(null);
  const [hebrew, setHebrew] = useState("");
  const [birthH, setBirthH] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = createClient();
    sb.from("synagogues").select("*").eq("status", "approved").then(({ data }) => setSynas((data as Synagogue[]) || []));
  }, []);

  const geo = FR_CITIES.find((c) => c.name === city);
  const filtered = synas.filter((s) => {
    const hay = (s.name + s.city).toLowerCase();
    const okQ = !q || hay.includes(q.toLowerCase());
    const okCity = !city || s.city.toLowerCase().includes(city.toLowerCase()) || city === "Paris";
    return okQ && (okCity || q);
  });

  async function loadCalendar(iso: string) {
    if (!iso) return;
    const p = new URLSearchParams({ date: iso, kind });
    if (birth) p.set("birth", birth);
    if (geo) {
      p.set("lat", String(geo.lat));
      p.set("lng", String(geo.lng));
    }
    const r = await fetch("/api/hebcal?" + p.toString());
    const j = await r.json();
    setReading(j.reading || null);
    setHebrew(j.hebrew?.hebrew || "");
    setBirthH(j.birthHebrew?.hebrew || "");
  }

  async function create() {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        child_first_name: first,
        child_last_name: last,
        kind,
        minhag,
        birth_date: birth || null,
        city,
        lat: geo?.lat,
        lng: geo?.lng,
        synagogue_id: synagogueId || null,
        date_tefilin: dateTef || null,
        date_shabbat: dateShab || null,
        date_party: dateParty || null,
        budget_envelope: envelope,
        kosher,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) {
      setErr(j.error || "Impossible de créer l’événement");
      return;
    }
    router.push("/app/" + j.id);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <p className="eyebrow">Création de l’événement</p>
      <h1 className="text-3xl mt-2">La {kind === "bat" ? "bat" : "bar"} mitzvah de {first || "votre enfant"}</h1>
      <p className="text-sm text-[var(--muted)] mt-1">Étape {step + 1} / 4</p>

      {step === 0 && (
        <div className="card p-5 mt-6 grid gap-3">
          <div className="flex gap-2">
            <button type="button" className={`btn ${kind === "bar" ? "" : "btn-ghost"}`} onClick={() => setKind("bar")}>
              Bar mitzvah
            </button>
            <button type="button" className={`btn ${kind === "bat" ? "" : "btn-ghost"}`} onClick={() => setKind("bat")}>
              Bat mitzvah
            </button>
          </div>
          <label>Prénom</label>
          <input value={first} onChange={(e) => setFirst(e.target.value)} required />
          <label>Nom</label>
          <input value={last} onChange={(e) => setLast(e.target.value)} />
          <label>Date de naissance</label>
          <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          <p className="text-sm text-[var(--muted)]">Âge halakhique usuel : {kind === "bat" ? "12" : "13"} ans révolus selon le calendrier juif — à confirmer avec votre rabbin.</p>
          <button className="btn mt-2" disabled={!first.trim()} onClick={() => setStep(1)}>
            Continuer
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card p-5 mt-6 grid gap-3">
          <label>Ville</label>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {FR_CITIES.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
          <label>Minhag</label>
          <select value={minhag} onChange={(e) => setMinhag(e.target.value)}>
            <option value="sepharade">Séfarade</option>
            <option value="ashkenaze">Ashkénaze</option>
            <option value="autre">Autre / mixte</option>
          </select>
          <label>Kasherut souhaitée</label>
          <select value={kosher} onChange={(e) => setKosher(e.target.value)}>
            <option value="casher">Casher</option>
            <option value="casher_glatt">Casher glatt</option>
            <option value="flexible">Flexible</option>
          </select>
          <div className="flex gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(0)}>
              Retour
            </button>
            <button className="btn" type="button" onClick={() => setStep(2)}>
              Continuer
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card p-5 mt-6 grid gap-3">
          <label>Rechercher une synagogue</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou ville" />
          <div className="max-h-64 overflow-auto grid gap-2">
            {filtered.slice(0, 20).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSynagogueId(s.id)}
                className={`text-left card p-3 ${synagogueId === s.id ? "ring-2 ring-[var(--gold)]" : ""}`}
              >
                <b>{s.name}</b>
                <div className="text-sm text-[var(--muted)]">
                  {s.city} · {s.rite}
                  {s.address ? ` · ${s.address}` : ""}
                </div>
              </button>
            ))}
          </div>
          <p className="text-sm text-[var(--muted)]">Vous pourrez suggérer une synagogue absente plus tard, dans l’espace de l’événement.</p>
          <div className="flex gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>
              Retour
            </button>
            <button className="btn" type="button" onClick={() => setStep(3)}>
              Continuer
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-5 mt-6 grid gap-3">
          <label>Date des tefilin (semaine)</label>
          <input type="date" value={dateTef} onChange={(e) => setDateTef(e.target.value)} />
          <label>Shabbat de la montée à la Torah</label>
          <input
            type="date"
            value={dateShab}
            onChange={(e) => {
              setDateShab(e.target.value);
              loadCalendar(e.target.value);
            }}
          />
          <label>Soirée</label>
          <input type="date" value={dateParty} onChange={(e) => setDateParty(e.target.value)} />
          <label>Enveloppe budget (€)</label>
          <input type="number" value={envelope} onChange={(e) => setEnvelope(e.target.value)} />
          {birthH && <p className="text-sm">Naissance civile {birth} → {birthH}</p>}
          {hebrew && <p className="text-sm">Shabbat choisi : {hebrew}</p>}
          {reading && (
            <div className="bg-[var(--gold-soft)] rounded-lg p-4 text-sm">
              <b>Lecture du calendrier (Hebcal)</b>
              {reading.parasha && (
                <p className="mt-2">
                  Paracha : {reading.parasha.title}
                  {reading.parasha.leyning?.haftarah ? ` · Haftara ${reading.parasha.leyning.haftarah}` : ""}
                </p>
              )}
              {reading.candles && <p>{reading.candles.title}</p>}
              {reading.havdalah && <p>{reading.havdalah.title}</p>}
              {reading.holidays.map((h: HebcalItem) => (
                <p key={h.date + h.title}>{h.title}</p>
              ))}
              <ul className="mt-2 list-disc pl-4">
                {reading.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {err && <p className="text-[var(--vire)] text-sm">{err}</p>}
          <div className="flex gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(2)}>
              Retour
            </button>
            <button className="btn" type="button" disabled={busy || !first} onClick={create}>
              Créer l’espace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
