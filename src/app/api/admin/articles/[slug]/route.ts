import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { validateArticleInput } from "@/lib/articles";
import { getArticleBySlug, updateArticle } from "@/lib/articles-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

function guard(req: NextRequest) {
  return isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

/** Rewrite an article. The slug is the address and is not editable, see articles-store. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });

  const { slug } = await ctx.params;
  if (!(await getArticleBySlug(slug))) {
    return NextResponse.json({ ok: false, errors: ["No such article."] }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  // The submitted slug is ignored in favour of the one in the URL, so a stale
  // form cannot move a published article to a new address.
  const parsed = validateArticleInput({ ...body, slug });
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const ok = await updateArticle(slug, parsed.value);
  if (!ok) return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 503 });
  return NextResponse.json({ ok: true, slug });
}
