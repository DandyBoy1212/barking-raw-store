// The five welcome sends: "your code is waiting" plus a four part story.
// Pure functions returning subject and HTML, in the house email style set by
// signInEmailHtml: Arial, 520px, black on white, bold uppercase heading, pill
// button, grey small print. British spelling, no em dashes. Every send ends
// with an unsubscribe line, because every one of these is marketing (12.2).
// Claims follow docs/research-dossier.md: the deception is provable, the
// disease-causation is not, so we teach and never scare.

import { unsubscribeUrl } from "./unsubscribe-links";

export type WelcomeEmail = { subject: string; html: string };

/**
 * Where each of the four story emails sends the reader.
 *
 * These used to be the four pillar pages, which are gone. The argument they
 * carried now lives on About in one piece, so the first three send there and the
 * last one, having made the case, sends to the shop.
 */
export const STORY_TARGETS = [
  { name: "The words that mean nothing", path: "/about" },
  { name: "The numbers on the pack", path: "/about" },
  { name: "The dental stick", path: "/about" },
  { name: "What a dog is built for", path: "/shop" },
] as const;

type CommonArgs = { siteUrl: string; email: string; secret: string };

function wrap(
  heading: string,
  bodyHtml: string,
  cta: { href: string; label: string },
  args: CommonArgs,
): string {
  const unsub = unsubscribeUrl(args.siteUrl, args.email, args.secret);
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">${heading}</h1>
    ${bodyHtml}
    <p><a href="${cta.href}" style="display:inline-block;background:#0b0b0b;color:#fff;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">${cta.label}</a></p>
    <p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
    <p style="color:#6b6b6b;font-size:13px">Had enough? <a href="${unsub}" style="color:#6b6b6b">Unsubscribe</a> and we will not email you again.</p>
  </div>`;
}

export function codeWaitingEmail(args: { code: string } & CommonArgs): WelcomeEmail {
  const body = `
    <p>Hi,</p>
    <p>Here is the 10% off your first order we promised. It works once, on anything in the shop.</p>
    <p style="font-size:22px;font-weight:900">Your code: <span style="background:#0b0b0b;color:#fff;padding:4px 10px;border-radius:6px">${args.code}</span></p>
    <p>Over the next fortnight we will send you four short emails: what we found when we started reading the back of dog treat packets, in the order we found it. No fluff, no scare stories, just what the labels and the biology actually say.</p>`;
  return {
    subject: "Your 10% code is waiting",
    html: wrap(
      "Your code is waiting.",
      body,
      { href: args.siteUrl, label: "Use it in the shop" },
      args,
    ),
  };
}

const STORY_BODIES: {
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
}[] = [
  {
    subject: "The three words on the back that mean nothing",
    heading: "Turn the packet over.",
    body: `
    <p>Hi,</p>
    <p>Email one of four. Go and get a packet of dog treats out of your cupboard, and read the back rather than the front.</p>
    <p>You will probably find <b>"meat and animal derivatives"</b>. That is not a description, it is a legal category, and it can stand in for almost anything an animal is made of. Next to it, <b>"cereals"</b>, which never has to say which cereal. And <b>"various sugars"</b>, which never has to say which sugars, or how much.</p>
    <p>Here is the part that matters: none of that is a loophole anybody sneaked through. UK and EU law permits those group terms outright. Any brand can name every ingredient in full if it chooses to. The ones using group terms are choosing not to.</p>`,
    ctaLabel: "Read the whole story",
  },
  {
    subject: "They print the numbers themselves",
    heading: "Then do the arithmetic.",
    body: `
    <p>Hi,</p>
    <p>Email two of four. The percentages are the part that gets you, because they are printed on the pack. Nobody is hiding them. They are relying on nobody adding them up.</p>
    <p>A treat sold on a picture of beef can be around <b>two per cent beef</b>. Not two per cent of the meat. Two per cent of the treat.</p>
    <p>A biscuit named for beef and vegetables can be nearly <b>sixty per cent cereal</b>, four per cent beef, and a third of one per cent of the vegetable on the front of the box.</p>
    <p>And sugar, declared third in the list, above the meat, in a product for an animal with no dietary need for it at all.</p>`,
    ctaLabel: "Read the whole story",
  },
  {
    subject: "The dental stick that is a cereal stick",
    heading: "This is where it stops being funny.",
    body: `
    <p>Hi,</p>
    <p>Email three of four, and this is the one that got us.</p>
    <p>The chew shaped like a bone. Sold on cleaning your dog's teeth, sold on a picture of meat. Read its ingredients and the first word is <b>cereals</b>. The meaty part, the part the entire product is named after, can be present in <b>milligrams per kilogram</b>. Milligrams. Of flavouring.</p>
    <p>Then there is what gets added deliberately. Propylene glycol keeps a soft treat soft, and is a close chemical relative of the glycol used in antifreeze. Regulators permit it in dog food. They banned it from cat food in 1996.</p>
    <p>None of this is a scandal. All of it is legal. That is rather the point.</p>`,
    ctaLabel: "Read the whole story",
  },
  {
    subject: "What your dog is actually built for",
    heading: "The bit that floored us.",
    body: `
    <p>Hi,</p>
    <p>Email four of four. None of the last three is the worst part. The worst part is what it is being fed to.</p>
    <p>Dogs have lived alongside us for thousands of years and can handle some starch, so this is not about banning every carbohydrate. But look at what a dog is built from: shearing teeth made to tear meat rather than molars made to grind grain, a short simple gut, a stomach sitting around pH 1 to 2, and <b>no salivary amylase at all</b>, which means digesting starch does not even begin in your dog's mouth.</p>
    <p>Now picture the cereal biscuit, dyed brown, shaped like a bone, with the sugar above the meat.</p>
    <p>That was our moment. You cannot unknow it, and once you have seen it the answer turns out to be very simple: meat, fish, air-dried or gently cooked, one thing, called by its name. That is the entire shop.</p>`,
    ctaLabel: "See what that leaves",
  },
];

export function storyEmail(index: 0 | 1 | 2 | 3, args: CommonArgs): WelcomeEmail {
  const p = STORY_BODIES[index];
  const href = `${args.siteUrl.replace(/\/$/, "")}${STORY_TARGETS[index].path}`;
  return {
    subject: p.subject,
    html: wrap(p.heading, p.body, { href, label: p.ctaLabel }, args),
  };
}
