import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 501 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { data: vendor } = await supabase.from("vendors").select("id").eq("user_id", user.id).maybeSingle();
  if (!vendor) return NextResponse.json({ error: "Pas de fiche" }, { status: 400 });
  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("vendor_id", vendor.id).maybeSingle();
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: "Pas encore d’abonnement Stripe." }, { status: 400 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/vendor`,
  });
  return NextResponse.json({ url: session.url });
}
