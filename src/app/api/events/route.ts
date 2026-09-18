import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findCity } from "@/lib/cities";
import { DEF_BUDGET, ensurePay } from "@/lib/planning";
import { buildPlan } from "@/lib/templates";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const body = await req.json();
  const city = String(body.city || "").trim();
  const geo = findCity(city);
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      created_by: user.id,
      child_first_name: String(body.child_first_name || "").trim(),
      child_last_name: body.child_last_name || null,
      kind: body.kind === "bat" ? "bat" : "bar",
      minhag: ["sepharade", "ashkenaze", "autre"].includes(body.minhag) ? body.minhag : "sepharade",
      birth_date: body.birth_date || null,
      city,
      lat: body.lat ?? geo?.lat ?? null,
      lng: body.lng ?? geo?.lng ?? null,
      synagogue_id: body.synagogue_id || null,
      date_tefilin: body.date_tefilin || null,
      date_shabbat: body.date_shabbat || null,
      date_party: body.date_party || null,
      budget_envelope: body.budget_envelope ? Number(body.budget_envelope) : null,
      guests: Number(body.guests) || 180,
      g_tef: Number(body.g_tef) || 50,
      g_kid: Number(body.g_kid) || 120,
      g_dej: Number(body.g_dej) || 30,
      kosher: body.kosher || "casher",
    })
    .select("*")
    .single();
  if (error || !event) return NextResponse.json({ error: error?.message || "Création impossible" }, { status: 400 });

  const B = {
    ...DEF_BUDGET,
    guests: event.guests,
    gTef: event.g_tef,
    gKid: event.g_kid,
    gDej: event.g_dej,
  };
  const dates = {
    child: event.child_first_name,
    kind: event.kind,
    tefilin: event.date_tefilin,
    shabbat: event.date_shabbat,
    party: event.date_party,
    city: event.city,
  };
  const P = ensurePay({}, B, dates);
  const tasks: Record<string, boolean> = {};
  buildPlan(dates);
  await supabase.from("app_state").upsert(
    [
      { event_id: event.id, key: "budget", data: B },
      { event_id: event.id, key: "pay", data: { pay: P } },
      { event_id: event.id, key: "tasks", data: { tasks } },
    ],
    { onConflict: "event_id,key" },
  );
  return NextResponse.json({ id: event.id });
}
