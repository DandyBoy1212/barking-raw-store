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
   * The legal name that has to appear on the terms. A sole trader trades under her
   * own name unless a company is registered, so this is either "Michaela <surname>"
   * or "Michaela <surname> trading as Barking Raw". She confirms which.
   */
  legalName: PENDING as string | Pending,

  /**
   * Required by the Companies Act only if she has incorporated. Left pending rather
   * than defaulted to "sole trader", because guessing her legal structure on a
   * public page is not ours to guess.
   */
  companyNumber: PENDING as string | Pending,

  /**
   * A real geographic address. UK consumer law requires it, and Stripe asks for it
   * before it will let an account trade properly. It does not have to be a shop, a
   * home address is lawful, but it cannot be absent and it cannot be a PO box alone.
   */
  address: PENDING as string | Pending,

  /** The address customers write to. Often the same as above. */
  contactEmail: PENDING as string | Pending,

  /** Optional in law, but the stall crowd will ring rather than email. */
  contactPhone: PENDING as string | Pending,

  /**
   * VAT registration, if she is registered. Most new sole traders are under the
   * threshold and are not, in which case prices simply carry no VAT line.
   */
  vatNumber: PENDING as string | Pending,

  /** Scotland, so Scots law governs and the courts are the Scottish courts. */
  jurisdiction: "Scotland",

  site: "barkingraw.dog",
} as const;

/** Every field Michaela still has to supply, in the order the pages need them. */
export function pendingBusinessFields(): string[] {
  const labels: Record<string, string> = {
    legalName: "the legal trading name",
    companyNumber: "the company number, if she has incorporated",
    address: "a real business address",
    contactEmail: "a contact email address",
    contactPhone: "a contact phone number",
    vatNumber: "a VAT number, if she is registered",
  };
  return Object.entries(labels)
    .filter(([key]) => BUSINESS[key as keyof typeof BUSINESS] === PENDING)
    .map(([, label]) => label);
}

export function businessDetailsPending(): boolean {
  return pendingBusinessFields().length > 0;
}

/** A field's value, or a visible placeholder that cannot be mistaken for the real thing. */
export function detail(key: keyof typeof BUSINESS): string {
  const value = BUSINESS[key];
  return value === PENDING ? "[to be confirmed]" : String(value);
}
