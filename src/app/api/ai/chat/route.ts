import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { readingForDate } from "@/lib/hebcal";
import { rankVendors } from "@/lib/matching";
import { totals, DEF_BUDGET, ensurePay } from "@/lib/planning";
import type { BudgetState, EventRow, PayState, Vendor } from "@/lib/types";

const DAILY_LIMIT = 40;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { event_id, message } = await req.json();
  if (!event_id || !message) return NextResponse.json({ error: "Message manquant" }, { status: 400 });

  const { data: mem } = await supabase.from("memberships").select("role").eq("event_id", event_id).eq("user_id", user.id).maybeSingle();
  if (!mem || mem.role === "viewer") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("ai_messages")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event_id)
    .eq("role", "user")
    .gte("created_at", since.toISOString());
  if ((count || 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: "Quota atteint (40 messages aujourd’hui)." }, { status: 429 });
  }

  const { data: event } = await supabase.from("events").select("*").eq("id", event_id).single();
  if (!event) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
  const ev = event as EventRow;

  const [{ data: st }, { data: syna }, { data: halls }, { data: vendors }, { data: history }] = await Promise.all([
    supabase.from("app_state").select("key,data").eq("event_id", event_id),
    ev.synagogue_id ? supabase.from("synagogues").select("*").eq("id", ev.synagogue_id).maybeSingle() : Promise.resolve({ data: null }),
    ev.synagogue_id ? supabase.from("halls").select("*").eq("synagogue_id", ev.synagogue_id) : Promise.resolve({ data: [] }),
    supabase.from("vendors").select("*"),
    supabase.from("ai_messages").select("role,content").eq("event_id", event_id).order("created_at", { ascending: false }).limit(8),
  ]);

  const B = { ...DEF_BUDGET, ...((st || []).find((r) => r.key === "budget")?.data as BudgetState | undefined) };
  const P = ensurePay({ ...(((st || []).find((r) => r.key === "pay")?.data as { pay?: PayState })?.pay || {}) }, B, {
    child: ev.child_first_name,
    kind: ev.kind,
    tefilin: ev.date_tefilin,
    shabbat: ev.date_shabbat,
    party: ev.date_party,
    city: ev.city,
  });
  const calc = totals(B, P, {
    child: ev.child_first_name,
    kind: ev.kind,
    tefilin: ev.date_tefilin,
    shabbat: ev.date_shabbat,
    party: ev.date_party,
    city: ev.city,
  });

  let calendar = null;
  if (ev.date_shabbat) {
    try {
      calendar = await readingForDate(ev.date_shabbat, ev.lat, ev.lng);
    } catch {
      calendar = null;
    }
  }

  const listed = rankVendors((vendors as Vendor[]) || [], ev).slice(0, 12);

  const key = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  await supabase.from("ai_messages").insert({ event_id, user_id: user.id, role: "user", content: String(message) });

  if (!process.env.OPENAI_API_KEY) {
    const fallback = buildFallback(ev, calendar, calc.grand, listed, syna, halls || []);
    await supabase.from("ai_messages").insert({ event_id, user_id: user.id, role: "assistant", content: fallback });
    return NextResponse.json({ reply: fallback, notice: "Clé OPENAI_API_KEY absente : réponse structurée sans LLM." });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sys = `Tu es l’assistant Simha, pour aider une famille à organiser une ${ev.kind} mitzvah en France.
Règles :
- Ne jamais inventer une paracha, un horaire de nérot/havdalah ou une fête. Utilise uniquement le JSON « calendrier_hebcal » fourni. S’il manque, dis-le.
- Mentionne qu’un rabbin doit valider minhag, âge halakhique (13 ans bar / 12 ans bat) et musique pendant le Omer.
- Tu peux commenter budget, contenance des salles vs effectifs, et citer UNIQUEMENT les prestataires listés (abonnés).
- Réponds en français, concret, bienveillant.
Contexte événement : ${JSON.stringify({
    enfant: ev.child_first_name,
    kind: ev.kind,
    minhag: ev.minhag,
    ville: ev.city,
    dates: { tefilin: ev.date_tefilin, shabbat: ev.date_shabbat, soirée: ev.date_party },
    effectifs: { soirée: ev.guests, tefilin: ev.g_tef, kiddouch: ev.g_kid, dej: ev.g_dej },
    enveloppe: ev.budget_envelope,
    budget_estime: Math.round(calc.grand),
    synagogue: syna,
    salles: halls,
    calendrier_hebcal: calendar
      ? {
          parasha: calendar.parasha?.title,
          candles: calendar.candles?.title,
          havdalah: calendar.havdalah?.title,
          holidays: calendar.holidays.map((h) => h.title),
          warnings: calendar.warnings,
        }
      : null,
    prestataires: listed.map((v) => ({ nom: v.name, categories: v.categories, ville: v.city, kasher: v.kasherut })),
  })}`;

  void key;
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      ...((history || []).reverse() as { role: "user" | "assistant"; content: string }[]).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: String(message) },
    ],
    temperature: 0.4,
  });
  const reply = completion.choices[0]?.message?.content || "Je n’ai pas pu répondre.";
  await supabase.from("ai_messages").insert({ event_id, user_id: user.id, role: "assistant", content: reply });
  void createServiceClient;
  return NextResponse.json({ reply });
}

function buildFallback(
  ev: EventRow,
  calendar: Awaited<ReturnType<typeof readingForDate>> | null,
  grand: number,
  vendors: { name: string; categories: string[] }[],
  syna: unknown,
  halls: { name: string; capacity: number; usage: string }[],
) {
  const lines = [
    `Voici une lecture factuelle pour la ${ev.kind} mitzvah de ${ev.child_first_name} à ${ev.city}.`,
    calendar?.parasha ? `Paracha (Hebcal) : ${calendar.parasha.title}.` : "Pas encore de Shabbat renseigné : ajoutez la date pour afficher la paracha.",
    calendar?.candles ? calendar.candles.title : "",
    calendar?.havdalah ? calendar.havdalah.title : "",
    ...(calendar?.warnings || []),
    `Budget estimé actuel : ${Math.round(grand)} €.`,
    syna ? `Synagogue liée enregistrée.` : "Aucune synagogue liée.",
    halls.length ? `Salles : ${halls.map((h) => `${h.name} (${h.capacity} pl., ${h.usage})`).join(" ; ")}.` : "",
    vendors.length ? `Prestataires abonnés ciblés : ${vendors.map((v) => v.name).join(", ")}.` : "Aucun prestataire abonné dans la cible pour l’instant.",
    "Ajoutez OPENAI_API_KEY pour des réponses conversationnelles. Confirmez toujours avec votre rabbin.",
  ];
  return lines.filter(Boolean).join("\n");
}
