// Minimal email sender via Resend's HTTP API. No SDK needed. Returns false
// (never throws) when RESEND_API_KEY is not set, so flows degrade gracefully.
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Barking Raw <hello@barkingraw.dog>";
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set, skipping send to", to);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) console.error("[email] send failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[email] send error:", err);
    return false;
  }
}
