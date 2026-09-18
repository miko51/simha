import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { readingForDate } from "@/lib/hebcal";
import { rankVendors } from "@/lib/matching";
import { totals, DEF_BUDGET, ensurePay } from "@/lib/planning";
import { guessVendorCategories } from "@/lib/chat";
import { directoryHref, vendorPageHref } from "@/lib/vendors";
import { VENDOR_LABELS, type BudgetState, type EventRow, type PayState, type Vendor, type VendorCategory } from "@/lib/types";

const DAILY_LIMIT = 40;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://simha-ivory.vercel.app";

function abs(path: string) {
  if (path.startsWith("http")) return path;
  return `${SITE.replace(/\/$/, "")}${path}`;
}

function vendorCards(list: Vendor[], city?: string | null) {
  return list.map((v) => ({
    nom: v.name,
    categories: (v.categories || []).map((c) => VENDOR_LABELS[c as VendorCategory] || c),
    ville: v.city,
    kasher: v.kasherut,
    prix_min: v.price_min,
    page: abs(vendorPageHref(v.id)),
    site: v.website || null,
    telephone: v.phone || null,
    annuaire: abs(directoryHref((v.categories?.[0] as VendorCategory) || "", city || v.city)),
  }));
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await req.json();
  const message = String(body.message || "").trim();
  const event_id = body.event_id ? String(body.event_id) : null;
  if (!message) return NextResponse.json({ error: "Message manquant" }, { status: 400 });

  const cats = guessVendorCategories(message);

  let ev: EventRow | null = null;
  if (event_id && user) {
    const { data: mem } = await supabase.from("memberships").select("role").eq("event_id", event_id).eq("user_id", user.id).maybeSingle();
    if (mem) {
      const { data: event } = await supabase.from("events").select("*").eq("id", event_id).maybeSingle();
      ev = (event as EventRow) || null;
    }
  }

  if (user) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    let q = supabase.from("ai_messages").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "user").gte("created_at", since.toISOString());
    if (ev) q = q.eq("event_id", ev.id);
    else q = q.is("event_id", null);
    const { count } = await q;
    if ((count || 0) >= DAILY_LIMIT) {
      return NextResponse.json({ error: "Quota atteint (40 messages aujourd’hui). Reviens demain, le petit Rav aussi se repose." }, { status: 429 });
    }
  }

  const { data: vendors } = await supabase.from("vendors").select("*");
  const all = (vendors as Vendor[]) || [];
  let listed: Vendor[] = ev ? rankVendors(all, ev) : all;
  if (cats.length) {
    const focused = listed.filter((v) => v.categories.some((c) => cats.includes(c as VendorCategory)));
    if (focused.length) listed = focused;
  }
  listed = listed.slice(0, 8);

  let calendar = null;
  if (ev?.date_shabbat) {
    try {
      calendar = await readingForDate(ev.date_shabbat, ev.lat, ev.lng);
    } catch {
      calendar = null;
    }
  }

  let calcGrand: number | null = null;
  if (ev) {
    const { data: st } = await supabase.from("app_state").select("key,data").eq("event_id", ev.id);
    const B = { ...DEF_BUDGET, ...((st || []).find((r) => r.key === "budget")?.data as BudgetState | undefined) };
    const P = ensurePay({ ...(((st || []).find((r) => r.key === "pay")?.data as { pay?: PayState })?.pay || {}) }, B, {
      child: ev.child_first_name,
      kind: ev.kind,
      tefilin: ev.date_tefilin,
      shabbat: ev.date_shabbat,
      party: ev.date_party,
      city: ev.city,
    });
    calcGrand = Math.round(
      totals(B, P, {
        child: ev.child_first_name,
        kind: ev.kind,
        tefilin: ev.date_tefilin,
        shabbat: ev.date_shabbat,
        party: ev.date_party,
        city: ev.city,
      }).grand,
    );
  }

  let history: { role: string; content: string }[] = [];
  if (user) {
    let hq = supabase.from("ai_messages").select("role,content").eq("user_id", user.id);
    hq = ev ? hq.eq("event_id", ev.id) : hq.is("event_id", null);
    const hist = await hq.order("created_at", { ascending: false }).limit(8);
    history = (hist.data || []) as { role: string; content: string }[];
  }

  if (user) {
    await supabase.from("ai_messages").insert({
      event_id: ev?.id || null,
      user_id: user.id,
      role: "user",
      content: message,
    });
  }

  const cards = vendorCards(listed, ev?.city);
  const annuaire = abs(directoryHref(cats[0] || "", ev?.city || null));

  if (!process.env.OPENAI_API_KEY) {
    const fallback = buildFallback(ev, calendar, calcGrand, cards, annuaire, cats);
    if (user) {
      await supabase.from("ai_messages").insert({
        event_id: ev?.id || null,
        user_id: user.id,
        role: "assistant",
        content: fallback,
      });
    }
    return NextResponse.json({ reply: fallback, notice: "Mode sans LLM : réponses structurées." });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sys = `Tu es Rav Simha, petit rav de poche espiègle et chaleureux, mascotte de l’app Simha (bar / bat mitzvah en France).
Tu tutoyas avec bienveillance, tu peux dire « Shalom », « Yasher koach », mais sans pastiche religieux excessif.
Règles :
- Ne jamais inventer une paracha, un horaire de nérot/havdalah ou une fête. Utilise uniquement le JSON calendrier_hebcal. S’il manque, dis-le et propose d’ajouter la date de Shabbat.
- Un vrai rabbin doit valider minhag, âge halakhique (13 ans bar / 12 ans bat) et musique pendant l’Omer.
- Prestataires : cite UNIQUEMENT ceux du JSON « prestataires ». Quand la question parle d’un métier (traiteur, DJ, photo, sofer, salle, fleurs, déco, gâteau, logistique, animation…), propose 1 à 3 fiches avec des liens markdown [Nom](page). Ajoute aussi [Voir l’annuaire](${annuaire}) si c’est utile. N’invente aucun nom hors liste. Si la liste est vide, oriente vers ${annuaire}.
- Réponds en français, concret, un peu fun, pas trop long (sauf si on te demande un discours).
Contexte : ${JSON.stringify({
    connecte: !!user,
    enfant: ev?.child_first_name || null,
    kind: ev?.kind || null,
    minhag: ev?.minhag || null,
    ville: ev?.city || null,
    dates: ev ? { tefilin: ev.date_tefilin, shabbat: ev.date_shabbat, soirée: ev.date_party } : null,
    effectifs: ev ? { soirée: ev.guests, tefilin: ev.g_tef, kiddouch: ev.g_kid, dej: ev.g_dej } : null,
    enveloppe: ev?.budget_envelope ?? null,
    budget_estime: calcGrand,
    metiers_detectes: cats,
    calendrier_hebcal: calendar
      ? {
          parasha: calendar.parasha?.title,
          candles: calendar.candles?.title,
          havdalah: calendar.havdalah?.title,
          holidays: calendar.holidays.map((h) => h.title),
          warnings: calendar.warnings,
        }
      : null,
    prestataires: cards,
    lien_annuaire: annuaire,
  })}`;

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      ...((history || []).reverse() as { role: "user" | "assistant"; content: string }[]).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ],
    temperature: 0.5,
  });
  const reply = completion.choices[0]?.message?.content || "Je n’ai pas pu répondre.";
  if (user) {
    await supabase.from("ai_messages").insert({
      event_id: ev?.id || null,
      user_id: user.id,
      role: "assistant",
      content: reply,
    });
  }
  return NextResponse.json({ reply });
}

function buildFallback(
  ev: EventRow | null,
  calendar: Awaited<ReturnType<typeof readingForDate>> | null,
  grand: number | null,
  vendors: { nom: string; page: string; categories: string[] }[],
  annuaire: string,
  cats: string[],
) {
  const lines = [
    "Shalom ! Voici ce que je peux dire sans inventer.",
    ev ? `On parle de la ${ev.kind} mitzvah de ${ev.child_first_name} à ${ev.city}.` : "Pas encore d’événement lié : je peux quand même t’orienter vers l’annuaire.",
    calendar?.parasha ? `Paracha (Hebcal) : ${calendar.parasha.title}.` : "",
    calendar?.candles ? calendar.candles.title : "",
    calendar?.havdalah ? calendar.havdalah.title : "",
    ...(calendar?.warnings || []),
    grand != null ? `Budget estimé actuel : ${grand} €.` : "",
    cats.length ? `Métier détecté : ${cats.join(", ")}.` : "",
    vendors.length
      ? vendors.map((v) => `- [${v.nom}](${v.page}) (${v.categories.join(", ")})`).join("\n")
      : `Aucun prestataire ciblé. [Voir l’annuaire](${annuaire})`,
    vendors.length ? `[Voir l’annuaire filtré](${annuaire})` : "",
    "Un rabbin de la communauté reste la référence pour le minhag et l’Omer.",
  ];
  return lines.filter(Boolean).join("\n");
}
