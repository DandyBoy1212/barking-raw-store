import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { getBucket } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload one dog photo. Mirrors the product image route, with two differences:
 * it is guarded by requireUser rather than requireStaff, because this is the
 * customer's own dog, and the object is filed under their uid so one account's
 * uploads can be found and removed without touching anybody else's.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });
  }

  const bucket = getBucket();
  if (!bucket) {
    return NextResponse.json({ ok: false, error: "Photo uploads are not switched on yet." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No photo was attached." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "That needs to be a JPEG, PNG or WebP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "That photo is over 5MB. A phone photo usually is, so try a smaller one." },
      { status: 400 },
    );
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `dogs/${user.uid}/${randomUUID()}.${ext}`;
  const gcsFile = bucket.file(path);

  let url: string;
  try {
    await gcsFile.save(Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      resumable: false,
    });
    // Long-lived signed read URL (the Admin SDK holds the service-account cert).
    [url] = await gcsFile.getSignedUrl({ action: "read", expires: "2500-01-01" });
  } catch (err) {
    console.error("[account-dog-photo] upload failed:", err);
    return NextResponse.json({ ok: false, error: "The photo would not upload." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url });
}
