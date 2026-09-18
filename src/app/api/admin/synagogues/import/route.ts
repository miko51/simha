import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin uniquement" }, { status: 403 });

  const text = await req.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].toLowerCase();
  const sep = header.includes(";") ? ";" : ",";
  const cols = header.split(sep).map((c) => c.trim());
  let n = 0;
  for (const line of lines.slice(1)) {
    const p = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const get = (name: string) => p[cols.indexOf(name)] || "";
    const name = get("name") || get("nom") || p[0];
    const city = get("city") || get("ville") || p[1];
    if (!name || !city) continue;
    const { data: syn } = await supabase
      .from("synagogues")
      .insert({
        name,
        city,
        address: get("address") || get("adresse") || null,
        postal_code: get("postal_code") || get("cp") || null,
        rite: ["sepharade", "ashkenaze", "massorti", "autre"].includes(get("rite")) ? get("rite") : "sepharade",
        notes: get("notes") || null,
        contact_phone: get("phone") || get("tel") || null,
        status: "approved",
      })
      .select("id")
      .single();
    n++;
    const hall = get("hall") || get("salle");
    const cap = Number(get("capacity") || get("contenance") || 0);
    if (syn && hall) {
      await supabase.from("halls").insert({
        synagogue_id: syn.id,
        name: hall,
        capacity: cap,
        usage: ["office", "kiddouch", "repas", "polyvalent"].includes(get("usage")) ? get("usage") : "polyvalent",
      });
    }
  }
  return NextResponse.json({ imported: n });
}
