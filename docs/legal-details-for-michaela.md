# What the legal pages need from Michaela

The five pages the site cannot trade without are now written and live on the branch:
terms, privacy, delivery, returns and cancellations, and contact. They are drafted against UK
consumer law, and they are deliberately not finished, because two things are missing and only
Michaela can supply them.

Every page currently shows a red "not ready to publish" box listing what is outstanding. The box
disappears on its own once `src/data/business.ts` is filled in. Nothing else has to be remembered
or removed.

## 1. The six details

These appear on the pages, and UK law requires most of them.

| What | Why it is needed | Notes |
|---|---|---|
| **Legal trading name** | Has to appear on the terms | Either her own name, or "Michaela [surname] trading as Barking Raw" if she has not incorporated |
| **A real business address** | Required by consumer law, and Stripe asks for it before it will let the account trade properly | A home address is lawful. A PO box on its own is not enough |
| **Contact email** | The route customers use for orders and returns | |
| **Contact phone** | Not legally required, but the stall crowd will ring rather than email | Leave it out if she would rather not publish a number, the page hides the section |
| **Company number** | Only if she has registered a limited company | Skip if she is a sole trader |
| **VAT number** | Only if she is VAT registered | Most new sole traders are under the threshold and are not |

## 2. The wording is hers to approve

The pages state positions that commit her, so she should read them rather than nod at them. The
three worth her attention:

- **Returns.** The customer's rights are against Barking Raw, not against the supplier, even for an
  item a supplier posted directly. The page says so plainly, because it is the law and because
  pointing a customer at somebody else's policy is the fastest way to a chargeback. It also asks
  customers to contact her for the return address rather than printing one, since her own stock
  comes back to her and supplier posted goods go back to the supplier.
- **Opened food cannot come back.** The page claims the food and hygiene exception in the Consumer
  Contracts Regulations, so sealed treats can be returned and opened ones cannot. That is the right
  position for a food business, but it is a position, and she should know she is taking it.
- **Feeding advice is not veterinary advice.** The terms say so, and say chews should be supervised.
  This protects her.

## 3. Two things worth paying for

Neither blocks launch, both are cheap insurance:

- **A solicitor's eye over the terms and the returns page.** These were written carefully against
  the legislation, but by a developer rather than a lawyer. An hour of a solicitor's time on a
  first draft costs far less than a dispute.
- **Public liability insurance**, if she does not already have it for the stall. Nothing to do with
  the website, but the stall is the main channel and it comes up in the same conversation.

## 4. The refund clock is shorter than her supply chain

Recorded here because it is money rather than code, and it will surprise her once if nobody says it
first. When a supplier posted item is returned, she legally owes her customer a refund within 14
days of getting the goods back. Avasam's supplier inspection and refund process can run longer than
that, and when it does pay out it pays into her Avasam balance rather than her bank. So she will
sometimes refund a customer out of her own pocket and be reimbursed later. Budget for it rather than
discover it.

## 5. Her terms document arrived, and what happened to it (added 2026-07-27)

Liam supplied `Barking_Raw_Terms_RA_TCS_01.pdf`. Its substance is now folded into the site's terms
and returns pages: the complementary pet food designation, the natural variation wording, the
repackaging-under-ABP-hygiene-rules line, acceptance at dispatch rather than at the confirmation
email, risk passing on delivery, and the 48 hour damaged-parcel report.

Three things it did NOT settle, so the red "not ready to publish" notices are still up:

- **The four missing details** (legal trading name, postcode, contact email, phone). The document
  names no person, no address and no contact route.
- **Governing law.** The document says "Laws of England & Wales / Scotland", which is two legal
  systems at once. The site says Scotland, because she trades from Dundee. If a solicitor drafted
  the document for England and Wales deliberately, that is a conversation, not a find-and-replace.
- **Two clauses were softened rather than adopted**, deliberately: the 48 hour damage report is
  presented as a request that helps a courier claim, because framed as a deadline it would cut
  across the 30 day short-term right to reject, which no term can. And "proven defective" is not
  used, because in the first six months the burden runs the other way: goods that fail are
  presumed faulty unless the trader shows otherwise.
