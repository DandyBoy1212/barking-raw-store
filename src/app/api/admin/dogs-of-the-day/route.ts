import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { validateDogFeatureInput } from "@/lib/dogs-of-the-day";
import { createDogFeature } from "@/lib/dogs-of-the-day-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Feature a dog (spec 10.2), from the staff picker only. The validator holds
 * the line that matters: the photo must already live on our own storage, so
 * this route cannot be used to put an arbitrary image on the public page even
 * by staff.
 */
export async function POST(req: NextRequest) {
  await requireStaff();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const parsed = validateDogFeatureInput(body, today);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const created = await createDogFeature(parsed.value);
  if (!created) {
    return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
