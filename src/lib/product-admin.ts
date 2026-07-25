import { ALL_BADGES, ALL_PILLARS, type Badge, type Pillar, type FulfilmentPath } from "@/data/products";

export { ALL_BADGES, ALL_PILLARS };

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ProductInput = {
  name: string;
  price: number;
  hook: string;
  description: string;
  badges: Badge[];
  image: string;
  safetyNote?: string;
  pillar: Pillar;
  leadTimeDays: number;
  membersOnlyUntil?: string;
  fulfilment: FulfilmentPath;
  supplierPostage?: number;
  supplierArrivalMinDays?: number;
  supplierArrivalMaxDays?: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateProductInput(
  input: Partial<ProductInput>,
): { ok: true; value: ProductInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = String(input.name ?? "").trim();
  const price = Number(input.price ?? 0);
  const hook = String(input.hook ?? "").trim();
  const description = String(input.description ?? "").trim();
  const image = String(input.image ?? "").trim();
  const badges = Array.isArray(input.badges)
    ? input.badges.filter((b): b is Badge => ALL_BADGES.includes(b as Badge))
    : [];
  const safetyNote = input.safetyNote ? String(input.safetyNote).trim() : undefined;

  if (!name) errors.push("Name is required.");
  if (!(Number.isFinite(price) && price > 0)) errors.push("Price must be greater than 0.");
  if (!hook) errors.push("Hook is required.");
  if (!description) errors.push("Description is required.");
  if (!image) errors.push("An image is required.");

  // A product with no pillar appears on no page, which looks exactly like the site
  // working while the product is invisible. Required, never defaulted, on the way in.
  const rawPillar = String(input.pillar ?? "");
  const pillarOk = ALL_PILLARS.includes(rawPillar as Pillar);
  if (!pillarOk) errors.push("Choose which pillar this product belongs to.");
  const pillar = (pillarOk ? rawPillar : "good-food") as Pillar;

  const rawLead =
    input.leadTimeDays === undefined ||
    input.leadTimeDays === null ||
    String(input.leadTimeDays) === ""
      ? 0
      : Number(input.leadTimeDays);
  const leadOk = Number.isFinite(rawLead) && rawLead >= 0 && Number.isInteger(rawLead);
  if (!leadOk) errors.push("Lead time must be a whole number of days, 0 or more.");
  const leadTimeDays = leadOk ? rawLead : 0;

  const rawWindow = String(input.membersOnlyUntil ?? "").trim();
  let membersOnlyUntil: string | undefined;
  if (rawWindow) {
    if (!ISO_DATE.test(rawWindow) || !Number.isFinite(Date.parse(`${rawWindow}T00:00:00Z`))) {
      errors.push("Members only date must be in the form YYYY-MM-DD.");
    } else {
      membersOnlyUntil = rawWindow;
    }
  }

  const fulfilment: FulfilmentPath =
    input.fulfilment === "supplier-posted" ? "supplier-posted" : "own-stock";

  let supplierPostage: number | undefined;
  let supplierArrivalMinDays: number | undefined;
  let supplierArrivalMaxDays: number | undefined;

  if (fulfilment === "supplier-posted") {
    const postage = Number(input.supplierPostage ?? NaN);
    if (!(Number.isFinite(postage) && postage >= 0)) {
      errors.push("Supplier posted products need their own postage amount.");
    } else {
      supplierPostage = postage;
    }
    const min = Number(input.supplierArrivalMinDays ?? NaN);
    const max = Number(input.supplierArrivalMaxDays ?? NaN);
    const minOk = Number.isFinite(min) && min > 0 && Number.isInteger(min);
    const maxOk = Number.isFinite(max) && max > 0 && Number.isInteger(max);
    if (minOk !== maxOk) {
      errors.push("Give both ends of the arrival range, or neither.");
    } else if (minOk && maxOk) {
      if (min > max) {
        errors.push("Arrival range must run from the shorter time to the longer.");
      } else {
        supplierArrivalMinDays = min;
        supplierArrivalMaxDays = max;
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      price,
      hook,
      description,
      badges,
      image,
      safetyNote,
      pillar,
      leadTimeDays,
      membersOnlyUntil,
      fulfilment,
      supplierPostage,
      supplierArrivalMinDays,
      supplierArrivalMaxDays,
    },
  };
}
