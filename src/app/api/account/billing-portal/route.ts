import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getSessionUser } from "@/lib/auth";
import { getCustomer } from "@/lib/customers-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Managing a repeating order is Stripe's own customer portal, not custom UI
 * (v1 decision, plan D8). One route, one session, one redirect. The portal must
 * be switched on once in Michaela's Stripe dashboard before this works live.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Not available yet." }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const customer = await getCustomer(user.uid);
  if (!customer?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No repeating order on this account yet." },
      { status: 404 },
    );
  }

  const origin =
    req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const stripe = new Stripe(secret);
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // The most likely cause is the portal not yet configured in the dashboard.
    console.error("[billing-portal] session create failed:", err);
    return NextResponse.json(
      { error: "We could not open your order settings just now. Please try again later." },
      { status: 502 },
    );
  }
}
