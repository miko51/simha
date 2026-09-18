import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { event_id, email, role } = await req.json();
  if (!event_id || !email) return NextResponse.json({ error: "Email requis" }, { status: 400 });
  const token = randomBytes(24).toString("hex");
  const { error } = await supabase.from("invites").insert({
    event_id,
    email: String(email).trim().toLowerCase(),
    role: role === "viewer" ? "viewer" : "editor",
    token,
    invited_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const origin = new URL(req.url).origin;
  return NextResponse.json({ url: `${origin}/invite/${token}` });
}
