// Pure logic for a stall sale (spec 10.1.2): validation, tolerant product doc
// reads, and the priced outcome (amounts, points, stock changes). No Firestore,
// no next/headers, no React, so this module is trivially unit-testable (mirrors
// stall-record.ts). Rates come from loyalty.ts, the code's single definition,
// never restated here.

import { earnRateFor, earnedPoints } from "@/lib/loyalty";
import { isUsableClientId } from "@/lib/stall-record";

export type StallSaleLine = { slug: string; qty: number };

/**
 * One sale as queued on the iPad and posted to the sale route.
 *
 * clientId is the idempotency key, exactly as on the signup record: syncing the
 * same sale twice decrements stock and awards points once. The customer may be
 * empty (a walk-up who declined signing up): the stock and revenue still land,
 * which is 10.1.2's headline requirement. Prices are deliberately absent, the
 * server prices every line from the product docs at apply time.
 */
export type StallSale = {
  clientId: string;
  recordedAt: string;
  customer: { uid: string; email: string; name: string };
  lines: StallSaleLine[];
  payment: "cash" | "card";
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_QTY = 99;

/**
 * Validate one sale from the queue.
 *
 * Lenient where the signup validator is lenient: junk lines and a junk customer
 * degrade rather than failing the sale, because Michaela is mid-conversation
 * with a queue behind her. Hard errors are only the three things that make the
 * record meaningless or unsafe to apply: no usable clientId (sync could not be
 * idempotent), nothing actually sold, and a payment that is neither cash nor
 * card (the tap is deliberate; a mangled value must not guess).
 */
export function validateStallSale(
  input: unknown,
  receivedAt: string,
): { ok: true; sale: StallSale } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Bad record."] };
  const raw = input as Record<string, unknown>;

  const errors: string[] = [];

  const clientId = String(raw.clientId ?? "").trim();
  if (!isUsableClientId(clientId)) errors.push("A record needs its client id.");

  const recordedRaw = String(raw.recordedAt ?? "").trim();
  const recordedAt = Number.isFinite(Date.parse(recordedRaw)) ? recordedRaw : receivedAt;

  // Junk lines drop, duplicates merge, quantities truncate into 1..99.
  const merged = new Map<string, number>();
  if (Array.isArray(raw.lines)) {
    for (const entry of raw.lines) {
      if (!entry || typeof entry !== "object") continue;
      const line = entry as Record<string, unknown>;
      const slug = String(line.slug ?? "").trim().toLowerCase();
      if (!SLUG_PATTERN.test(slug)) continue;
      const qty = Math.trunc(Number(line.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) continue;
      merged.set(slug, Math.min(MAX_QTY, (merged.get(slug) ?? 0) + qty));
    }
  }
  const lines: StallSaleLine[] = [...merged].map(([slug, qty]) => ({ slug, qty }));
  if (!lines.length) errors.push("Nothing sold.");

  const payment = raw.payment;
  if (payment !== "cash" && payment !== "card") errors.push("How was it paid?");

  if (errors.length) return { ok: false, errors };

  const customerRaw = (raw.customer ?? {}) as Record<string, unknown>;
  const uidRaw = String(customerRaw.uid ?? "").trim();
  const emailRaw = String(customerRaw.email ?? "").trim().toLowerCase();
  const customer = {
    uid: UID_PATTERN.test(uidRaw) ? uidRaw : "",
    email: emailRaw.includes("@") ? emailRaw : "",
    name: String(customerRaw.name ?? "").trim(),
  };

  return {
    ok: true,
    sale: { clientId, recordedAt, customer, lines, payment: payment as "cash" | "card" },
  };
}

/**
 * What a sale needs to know about a product, read straight off the raw doc so
 * the transaction does not depend on the catalogue mapper. Absent stock means
 * untracked (stage 4's rule): the product sells without a count and nothing is
 * written back.
 */
export type SaleProduct = {
  slug: string;
  name: string;
  price: number;
  pointsPerPound?: number;
  stock?: number;
};

export function docToSaleProduct(id: string, data: Record<string, unknown>): SaleProduct {
  const price = Number(data.price);
  const product: SaleProduct = {
    slug: id,
    name: String(data.name ?? id),
    price: Number.isFinite(price) && price >= 0 ? price : 0,
  };
  const rate = Number(data.pointsPerPound);
  if (Number.isFinite(rate) && rate >= 0) product.pointsPerPound = rate;
  const stock = Number(data.stock);
  if (Number.isFinite(stock) && stock >= 0) product.stock = Math.trunc(stock);
  return product;
}

export type SaleOutcome = {
  items: { slug: string; name: string; qty: number; amount: number; points: number }[];
  total: number;
  points: number;
  stockChanges: { slug: string; stock: number }[];
};

const roundPence = (n: number) => Math.round(n * 100) / 100;

/**
 * Price a sale against the shelf. Every line must name a real product, because
 * an invented slug recorded as revenue would silently corrupt stock and points;
 * the sale comes back 400 and waits on the iPad for a second look instead.
 * Amounts come from the product docs, points from loyalty.ts's per-product
 * rate, stock changes only for tracked products, clamped at zero.
 */
export function buildSaleOutcome(
  sale: StallSale,
  products: Map<string, SaleProduct>,
): { ok: true; outcome: SaleOutcome } | { ok: false; errors: string[] } {
  const missing = sale.lines.filter((l) => !products.has(l.slug)).map((l) => l.slug);
  if (missing.length) {
    return { ok: false, errors: [`Not on the shelf list: ${missing.join(", ")}`] };
  }

  const items = sale.lines.map((line) => {
    const product = products.get(line.slug)!;
    const amount = roundPence(product.price * line.qty);
    return {
      slug: line.slug,
      name: product.name,
      qty: line.qty,
      amount,
      points: earnedPoints(amount, earnRateFor(product)),
    };
  });

  const stockChanges = sale.lines.flatMap((line) => {
    const product = products.get(line.slug)!;
    if (typeof product.stock !== "number") return [];
    return [{ slug: line.slug, stock: Math.max(0, product.stock - line.qty) }];
  });

  return {
    ok: true,
    outcome: {
      items,
      total: roundPence(items.reduce((sum, i) => sum + i.amount, 0)),
      points: items.reduce((sum, i) => sum + i.points, 0),
      stockChanges,
    },
  };
}
