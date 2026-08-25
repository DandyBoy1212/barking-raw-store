import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { setArticlePublished } from "@/lib/articles-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

function guard(req: NextRequest) {
  return isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

/** Publish or unpublish. Never deletes: the undo is the other direction. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });

  const { slug } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* an empty body means publish */
  }
  const published = body.published !== false;

  const ok = await setArticlePublished(slug, published);
  if (!ok) return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 503 });
  return NextResponse.json({ ok: true, published });
}
