import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { validatePostInput } from "@/lib/posts";
import { createPost } from "@/lib/posts-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

/** Same-origin check, the house CSRF pattern for state-changing routes. */
function guard(req: NextRequest) {
  return isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

/** Create a post. Staff only; the members area is the audience, spec 7.2. */
export async function POST(req: NextRequest) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const parsed = validatePostInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const id = await createPost(parsed.value);
  if (!id) return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 503 });
  return NextResponse.json({ ok: true, id });
}
