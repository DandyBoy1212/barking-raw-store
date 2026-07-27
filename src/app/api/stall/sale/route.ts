import { NextResponse, type NextRequest } from "next/server";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { validateStallSale } from "@/lib/stall-sale";
import { applyStallSale } from "@/lib/stall-sale-store";
import { hasStallAccess } from "@/lib/stall-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Take one queued stall sale. The client maps the response onto a queue outcome
 * exactly as the signup sync does: 2xx synced, 400 rejected (kept and flagged
 * on the iPad, never dropped), anything else retry. 401 also tells the iPad
 * its stall session has ended. No email of any kind goes from here.
 */
export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });
  }
  if (!(await hasStallAccess())) {
    return NextResponse.json({ ok: false, error: "The stall session has ended." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad record."] }, { status: 400 });
  }

  const parsed = validateStallSale(body, new Date().toISOString());
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const result = await applyStallSale(parsed.sale);
  if (!result.ok) {
    if (!result.retryable) {
      // The sale named something unknowable (a product not on the shelf list).
      // 400 keeps it on the iPad, flagged for a manual second go.
      return NextResponse.json(
        { ok: false, errors: result.errors ?? ["Could not take that sale."] },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, error: "Could not save just now." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
