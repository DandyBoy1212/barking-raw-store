import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { updateCustomerDetails } from "@/lib/customers-store";
import type { CustomerAddress } from "@/data/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  // Session uid only. A uid in the body would let one customer rewrite another's record.
  const user = await requireUser();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  }

  let input: { name?: string; phone?: string; address?: Partial<CustomerAddress> };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const ok = await updateCustomerDetails(user.uid, input);
  if (!ok) return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  return NextResponse.json({ ok: true });
}
