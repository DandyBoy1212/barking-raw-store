import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { validateArticleInput } from "@/lib/articles";
import { createArticle } from "@/lib/articles-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

/** Same-origin check, the house CSRF pattern for state-changing routes. */
function guard(req: NextRequest) {
  return isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

/** Create a blog article, as a draft. Staff only. */
export async function POST(req: NextRequest) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const parsed = validateArticleInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const result = await createArticle(parsed.value);
  if (!result.ok) {
    return result.reason === "exists"
      ? NextResponse.json(
          {
            ok: false,
            errors: [
              `There is already an article at /blog/${parsed.value.slug}. Give this one a different web address.`,
            ],
          },
          { status: 409 },
        )
      : NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 503 });
  }
  return NextResponse.json({ ok: true, slug: parsed.value.slug });
}
