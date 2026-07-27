// The five welcome sends: "your code is waiting" plus one email per pillar.
// Pure functions returning subject and HTML, in the house email style set by
// signInEmailHtml: Arial, 520px, black on white, bold uppercase heading, pill
// button, grey small print. British spelling, no em dashes. Every send ends
// with an unsubscribe line, because every one of these is marketing (12.2).
// Claims follow docs/research-dossier.md: the deception is provable, the
// disease-causation is not, so we teach and never scare.

import { unsubscribeUrl } from "./unsubscribe-links";

export type WelcomeEmail = { subject: string; html: string };

export const PILLARS = [
  { name: "Good Food", path: "/good-food" },
  { name: "Comfy Walks", path: "/comfy-walks" },
  { name: "Fun & Games", path: "/fun-and-games" },
  { name: "Cosy Sleep", path: "/cosy-sleep" },
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
    <p>Over the next fortnight we will send you four short emails, one for each of the four things a dog needs before training will ever stick. No fluff, no scare stories, just what the labels and the biology actually say.</p>`;
  return {
    subject: "Your 10% code is waiting",
    html: wrap("Your code is waiting.", body, { href: args.siteUrl, label: "Use it in the shop" }, args),
  };
}

const PILLAR_BODIES: { subject: string; heading: string; body: string; ctaLabel: string }[] = [
  {
    subject: "Good Food: what goes in shows up in everything else",
    heading: "Good food first.",
    body: `
    <p>Hi,</p>
    <p>Get these four right and your dog will lap up training: good food, comfy walks, fun and games, cosy sleep. Most people start with training. That is the last bit, not the first. This is email one of four, and it starts where everything starts.</p>
    <p><b>What goes in shows up in everything else.</b> Coat, teeth, energy, stools, even mood.</p>
    <p>UK law lets a label say "cereals" and "meat and animal derivatives" without naming a single ingredient. That is why a "beef" treat can be 2% beef with sugars listed above the meat, straight off the pack. We choose the opposite: open declaration, every ingredient named. If it says beef trachea, that is the list.</p>
    <p>Your dog is not a bin. Dogs can digest some starch, but from teeth to gut they are built primarily for meat, and they thrive on meat-rich, minimally processed food.</p>`,
    ctaLabel: "Read the Good Food page",
  },
  {
    subject: "Comfy Walks: is the walk actually comfortable?",
    heading: "Comfy walks.",
    body: `
    <p>Hi,</p>
    <p>Email two of four. A dog that is choking on a collar is not enjoying the walk. You are just dragging it.</p>
    <p>Comfort changes behaviour. A fitted harness spreads the pressure a collar puts on the throat, and a longer line gives the nose room to work, which is most of what a walk is for. A dog that is comfortable pulls less, sniffs more, and comes home walked rather than wound up.</p>
    <p>Three things worth checking today: does the harness rub behind the legs, can you fit two fingers under every strap, and is the lead long enough to let the head drop to the ground?</p>`,
    ctaLabel: "Read the Comfy Walks page",
  },
  {
    subject: "Fun & Games: a bored dog finds his own fun",
    heading: "Fun and games.",
    body: `
    <p>Hi,</p>
    <p>Email three of four. A bored dog will find his own fun. You won't like it.</p>
    <p>Chewed skirting, dug beds and a shredded post pile are rarely naughtiness. They are a clever animal with an empty afternoon. Ten minutes of sniffing and working for food tires a dog in a way a long march does not, because the nose is doing the thinking.</p>
    <p>Easy wins: scatter part of a meal in the grass, roll a towel around some treats, or use a lickimat or snuffle mat and let the dog work. Work first, then rest. That order matters, and email four is about the rest.</p>`,
    ctaLabel: "Read the Fun & Games page",
  },
  {
    subject: "Cosy Sleep: an overtired dog can't think straight",
    heading: "Cosy sleep.",
    body: `
    <p>Hi,</p>
    <p>Email four of four. An overtired dog can't think straight.</p>
    <p>Adult dogs sleep a large part of the day when they are allowed to, and puppies need even more. A dog that never properly switches off gets scratchy, mouthy and deaf to everything it knows, much like the rest of us.</p>
    <p>What helps is simple: a bed somewhere calm away from the household traffic, a routine that puts proper rest after play, and the confidence to let a settled dog lie. Get all four of these right, food, walks, games and sleep, and training stops being a battle, because the dog finally has everything it needs to listen.</p>`,
    ctaLabel: "Read the Cosy Sleep page",
  },
];

export function pillarEmail(index: 0 | 1 | 2 | 3, args: CommonArgs): WelcomeEmail {
  const p = PILLAR_BODIES[index];
  const href = `${args.siteUrl.replace(/\/$/, "")}${PILLARS[index].path}`;
  return {
    subject: p.subject,
    html: wrap(p.heading, p.body, { href, label: p.ctaLabel }, args),
  };
}
