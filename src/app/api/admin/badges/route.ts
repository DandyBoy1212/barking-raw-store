import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/auth-helpers";
import { createBadge, getAllBadges } from "@/lib/badges-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

export async function GET() {
  await requireStaff();
  return NextResponse.json({ ok: true, badges: await getAllBadges() });
}

export async function POST(req: NextRequest) {
  await requireStaff();
  if (!isAllowedOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl())) {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  }

  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const result = await createBadge(String(body.label ?? ""));
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
