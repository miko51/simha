import { NextResponse } from "next/server";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { findCity } from "@/lib/cities";
import { DEF_BUDGET, ensurePay } from "@/lib/planning";
import { buildPlan } from "@/lib/templates";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jgqwqebwfwrtqhcbvrso.supabase.co";
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpncXdxZWJ3ZndydHFoY2J2cnNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MTE1NzksImV4cCI6MjEwNTI4NzU3OX0.yMRE7dUhTAerJIopQWG77LPVure9gFQSqU-YnH5flfM";
  const db = token
    ? createJsClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;

  const body = await req.json();
  const city = String(body.city || "").trim();
  const geo = findCity(city);
  const payload = {
    email: user.email || "",
    child_first_name: String(body.child_first_name || "").trim(),
    child_last_name: body.child_last_name || "",
    kind: body.kind === "bat" ? "bat" : "bar",
    minhag: ["sepharade", "ashkenaze", "autre"].includes(body.minhag) ? body.minhag : "sepharade",
    birth_date: body.birth_date || "",
    city,
    lat: body.lat ?? geo?.lat ?? null,
    lng: body.lng ?? geo?.lng ?? null,
    synagogue_id: body.synagogue_id || "",
    date_tefilin: body.date_tefilin || "",
    date_shabbat: body.date_shabbat || "",
    date_party: body.date_party || "",
    budget_envelope: body.budget_envelope || "",
    guests: Number(body.guests) || 180,
    g_tef: Number(body.g_tef) || 50,
    g_kid: Number(body.g_kid) || 120,
    g_dej: Number(body.g_dej) || 30,
    kosher: body.kosher || "casher",
  };

  await db.from("profiles").upsert(
    { id: user.id, email: user.email || "", role: "family" },
    { onConflict: "id", ignoreDuplicates: true },
  );

  let event: Record<string, unknown> | null = null;
  let errorMessage = "";

  const rpc = await db.rpc("create_family_event", { payload });
  if (rpc.data) event = rpc.data as Record<string, unknown>;
  else if (rpc.error) errorMessage = rpc.error.message;

  if (!event) {
    const inserted = await db
      .from("events")
      .insert({
        created_by: user.id,
        child_first_name: payload.child_first_name,
        child_last_name: payload.child_last_name || null,
        kind: payload.kind,
        minhag: payload.minhag,
        birth_date: payload.birth_date || null,
        city,
        lat: typeof payload.lat === "number" ? payload.lat : geo?.lat ?? null,
        lng: typeof payload.lng === "number" ? payload.lng : geo?.lng ?? null,
        synagogue_id: payload.synagogue_id || null,
        date_tefilin: payload.date_tefilin || null,
        date_shabbat: payload.date_shabbat || null,
        date_party: payload.date_party || null,
        budget_envelope: payload.budget_envelope ? Number(payload.budget_envelope) : null,
        guests: payload.guests,
        g_tef: payload.g_tef,
        g_kid: payload.g_kid,
        g_dej: payload.g_dej,
        kosher: payload.kosher,
      })
      .select("*")
      .single();
    if (inserted.data) event = inserted.data as Record<string, unknown>;
    else errorMessage = inserted.error?.message || errorMessage;
  }

  if (!event) {
    return NextResponse.json({ error: errorMessage || "Création impossible" }, { status: 400 });
  }

  await db.from("memberships").upsert(
    { event_id: event.id, user_id: user.id, role: "owner" },
    { onConflict: "event_id,user_id" },
  );

  const B = {
    ...DEF_BUDGET,
    guests: Number(event.guests) || 180,
    gTef: Number(event.g_tef) || 50,
    gKid: Number(event.g_kid) || 120,
    gDej: Number(event.g_dej) || 30,
  };
  const dates = {
    child: String(event.child_first_name),
    kind: (event.kind === "bat" ? "bat" : "bar") as "bar" | "bat",
    tefilin: (event.date_tefilin as string) || null,
    shabbat: (event.date_shabbat as string) || null,
    party: (event.date_party as string) || null,
    city: String(event.city),
  };
  const P = ensurePay({}, B, dates);
  const tasks: Record<string, boolean> = {};
  buildPlan(dates);
  await db.from("app_state").upsert(
    [
      { event_id: event.id, key: "budget", data: B },
      { event_id: event.id, key: "pay", data: { pay: P } },
      { event_id: event.id, key: "tasks", data: { tasks } },
    ],
    { onConflict: "event_id,key" },
  );
  return NextResponse.json({ id: event.id });
}
