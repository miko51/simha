import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function stripe() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) return null;
  return new Stripe(k);
}

export async function POST() {
  const s = stripe();
  if (!s || !process.env.STRIPE_PRICE_ID) {
    return NextResponse.json({ error: "Stripe n’est pas configuré (STRIPE_SECRET_KEY + STRIPE_PRICE_ID)." }, { status: 501 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { data: vendor } = await supabase.from("vendors").select("*").eq("user_id", user.id).maybeSingle();
  if (!vendor) return NextResponse.json({ error: "Créez d’abord votre fiche prestataire." }, { status: 400 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    customer_email: user.email || undefined,
    metadata: { vendor_id: vendor.id, user_id: user.id },
    subscription_data: { metadata: { vendor_id: vendor.id, user_id: user.id } },
    success_url: `${origin}/vendor?checkout=success`,
    cancel_url: `${origin}/vendor?checkout=cancel`,
  });
  return NextResponse.json({ url: session.url });
}
