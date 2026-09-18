import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return NextResponse.json({ error: "Webhook non configuré" }, { status: 501 });
  const stripe = new Stripe(key);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Signature invalide" }, { status: 400 });
  }
  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 });
  const db = svc;

  async function upsert(vendorId: string, status: string, customer?: string | null, subId?: string | null, end?: number | null) {
    await db.from("subscriptions").upsert(
      {
        vendor_id: vendorId,
        status,
        stripe_customer_id: customer || null,
        stripe_subscription_id: subId || null,
        current_period_end: end ? new Date(end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vendor_id" },
    );
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const vendorId = s.metadata?.vendor_id;
    if (vendorId) {
      const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
      await upsert(vendorId, "active", typeof s.customer === "string" ? s.customer : null, subId || null, null);
    }
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const vendorId = sub.metadata?.vendor_id;
    let vid = vendorId;
    if (!vid) {
      const { data } = await db.from("subscriptions").select("vendor_id").eq("stripe_subscription_id", sub.id).maybeSingle();
      vid = data?.vendor_id;
    }
    if (vid) {
      const status = sub.status === "active" || sub.status === "trialing" ? sub.status : sub.status === "past_due" ? "past_due" : "canceled";
      const end = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
      await upsert(vid, status, typeof sub.customer === "string" ? sub.customer : null, sub.id, end || null);
    }
  }
  return NextResponse.json({ received: true });
}
