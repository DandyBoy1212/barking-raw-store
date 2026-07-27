// The business identity that the legal pages, the contact page and the emails all
// quote. One file, because a trading name or an address that disagrees with itself
// across five pages is exactly the sort of thing that costs a Stripe review.
//
// Everything marked PENDING is a placeholder that Michaela has to replace before the
// site trades. They are not invented values dressed up as real ones: the pages check
// `businessDetailsPending()` and print a visible notice for anything still unanswered,
// so a placeholder cannot go live quietly.

export const PENDING = "PENDING" as const;

export type Pending = typeof PENDING;

export const BUSINESS = {
  /** The name the customer sees. Safe: this one is real. */
  tradingName: "Barking Raw",

  /**
   * The legal name that has to appear on the terms. Confirmed 2026-07-27: she is
   * self-employed, trading as Barking Raw, so the terms render this name with
   * "trading as Barking Raw" after it.
   */
  legalName: "Michaela Anderson" as string | Pending,

  /**
   * Confirmed 2026-07-27: she is a sole trader, no limited company, so there is no
   * company number and the pages simply do not mention one. Empty means
   * "not applicable", which is different from PENDING, which means "unanswered".
   */
  companyNumber: "" as string | Pending,

  /**
   * A real geographic address. UK consumer law requires it, and Stripe asks for it
   * before it will let an account trade properly. It does not have to be a shop, a
   * home address is lawful, but it cannot be absent and it cannot be a PO box alone.
   *
   * Given by Liam on 2026-07-25; postcode supplied 2026-07-27.
   */
  address: "12 Brown Constable Pend, Dundee, DD4 6QU" as string | Pending,

  /** The address customers write to. Often the same as above. */
  contactEmail: "mikkzter@gmail.com" as string | Pending,

  /**
   * Optional in law, but the stall crowd will ring rather than email. Not supplied
   * yet; the pages hide the phone section until it is.
   */
  contactPhone: "" as string | Pending,

  /**
   * VAT registration, if she is registered. Most new sole traders are under the
   * threshold and are not, in which case prices simply carry no VAT line.
   */
  vatNumber: "" as string | Pending,

  /** Scotland, so Scots law governs and the courts are the Scottish courts. */
  jurisdiction: "Scotland",

  site: "barkingraw.dog",
} as const;

/**
 * A UK postcode anywhere in the string. Deliberately loose: it is checking that
 * somebody remembered the postcode at all, not validating the address.
 */
function hasPostcode(value: string): boolean {
  return /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(value);
}

/** True when a field holds a real value: not PENDING, not empty. */
export function provided(key: keyof typeof BUSINESS): boolean {
  const value = BUSINESS[key];
  return value !== PENDING && String(value).trim() !== "";
}

/**
 * The fields the pages cannot lawfully publish without. Phone, VAT number and
 * company number are deliberately not here: they are optional, render nothing
 * when absent, and must not keep the "not ready to publish" notice up.
 */
export function pendingBusinessFields(): string[] {
  const labels: Record<string, string> = {
    legalName: "the legal trading name",
    address: "a real business address",
    contactEmail: "a contact email address",
  };
  const missing = Object.entries(labels)
    .filter(([key]) => BUSINESS[key as keyof typeof BUSINESS] === PENDING)
    .map(([, label]) => label);

  // An address without a postcode is not an address a customer can write to, and
  // it is not what Stripe is asking for either. Keep flagging it until it has one.
  if (BUSINESS.address !== PENDING && !hasPostcode(String(BUSINESS.address))) {
    missing.push("the postcode for the business address");
  }

  return missing;
}

export function businessDetailsPending(): boolean {
  return pendingBusinessFields().length > 0;
}

/** A field's value, or a visible placeholder that cannot be mistaken for the real thing. */
export function detail(key: keyof typeof BUSINESS): string {
  const value = BUSINESS[key];
  return value === PENDING ? "[to be confirmed]" : String(value);
}
