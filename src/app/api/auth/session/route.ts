import { NextResponse, type NextRequest } from "next/server";
import { createSession, clearSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (typeof body.idToken !== "string" || !body.idToken) {
    return NextResponse.json({ error: "no token" }, { status: 400 });
  }
  const ok = await createSession(body.idToken);
  if (!ok) return NextResponse.json({ error: "auth unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
