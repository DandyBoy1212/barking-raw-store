import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireStaff } from "@/lib/auth";
import { getBucket } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest) {
  await requireStaff();
  const bucket = getBucket();
  if (!bucket) return NextResponse.json({ ok: false, error: "storage not configured" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "no file" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ ok: false, error: "unsupported type" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: "file too large" }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `products/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const gcsFile = bucket.file(path);

  let url: string;
  try {
    await gcsFile.save(buffer, { contentType: file.type, resumable: false });
    // Long-lived signed read URL (works because the Admin SDK holds the service-account cert).
    [url] = await gcsFile.getSignedUrl({ action: "read", expires: "2500-01-01" });
  } catch (err) {
    console.error("[admin-products-image] upload failed:", err);
    return NextResponse.json({ ok: false, error: "upload failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url });
}
