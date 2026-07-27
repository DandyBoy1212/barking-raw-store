import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/auth-helpers";
import { renameBadge, setBadgeRetired } from "@/lib/badges-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

function guard(req: NextRequest) {
  return isAllowedOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const { slug } = await params;

  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const result = await renameBadge(slug, String(body.label ?? ""));
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

/** Retire, or un-retire with {"retired": false}. Never deletes. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const { slug } = await params;

  let retired = true;
  try {
    const body = await req.json();
    if (body && body.retired === false) retired = false;
  } catch {
    // No body means retire, which is what the button sends.
  }

  const result = await setBadgeRetired(slug, retired);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
