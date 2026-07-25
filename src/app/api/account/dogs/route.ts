import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { upsertDog, removeDog } from "@/lib/customers-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

/** Same-origin check, the house CSRF pattern for state-changing routes. */
function guard(req: NextRequest) {
  return isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // The uid comes from the session and never from the body. If it came from the
  // body, anybody signed in could rewrite anybody else's dogs.
  const user = await requireUser();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const input = await body(req);
  if (!input) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });

  const result = await upsertDog(user.uid, null, input);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, dog: result.dog });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const input = await body(req);
  if (!input) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });

  const dogId = String(input.id ?? "").trim();
  if (!dogId) return NextResponse.json({ ok: false, errors: ["Which dog?"] }, { status: 400 });

  const result = await upsertDog(user.uid, dogId, input);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, dog: result.dog });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const input = await body(req);
  const dogId = String(input?.id ?? "").trim();
  if (!dogId) return NextResponse.json({ ok: false, errors: ["Which dog?"] }, { status: 400 });

  const ok = await removeDog(user.uid, dogId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
