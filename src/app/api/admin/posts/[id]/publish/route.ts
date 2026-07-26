import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { getPostById, setPostPublished } from "@/lib/posts-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

/** Same-origin check, the house CSRF pattern for state-changing routes. */
function guard(req: NextRequest) {
  return isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

/**
 * Unpublish or republish, mirroring the products archive toggle. Never a
 * delete: an unpublished post keeps its words and can come back (spec 7.2).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const { id } = await ctx.params;

  let body: { published?: unknown };
  try {
    body = (await req.json()) as { published?: unknown };
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }
  const published = body.published === true;

  if (!(await getPostById(id))) {
    return NextResponse.json({ ok: false, errors: ["Post not found."] }, { status: 404 });
  }

  const saved = await setPostPublished(id, published);
  if (!saved) return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 503 });
  return NextResponse.json({ ok: true, id, published });
}
