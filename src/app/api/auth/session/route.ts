import { NextResponse, type NextRequest } from "next/server";
import { createSession, clearSession } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkOrigin(req: NextRequest): boolean {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  return isAllowedOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl);
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: { idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (typeof body.idToken !== "string" || !body.idToken) {
    return NextResponse.json({ error: "no token" }, { status: 400 });
  }
  const result = await createSession(body.idToken);
  if (result === "invalid") return NextResponse.json({ error: "invalid token" }, { status: 401 });
  if (result === "unavailable") return NextResponse.json({ error: "auth unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await clearSession();
  return NextResponse.json({ ok: true });
}
