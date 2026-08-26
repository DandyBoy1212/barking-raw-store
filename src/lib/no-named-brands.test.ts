import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Michaela's standing instruction: no other company is named anywhere on the
 * site. Not once, not in passing, not in a caption.
 *
 * The argument the site makes about labelling is true of the category and is
 * made about the category. Naming a brand while making it turns a fair
 * criticism into a target, and it is not a risk a one person shop in Dundee
 * should be carrying.
 *
 * This guards the whole of src rather than one page, because the way this
 * instruction gets broken is somebody adding a "for example" to a new page
 * months from now, not somebody editing the page it was removed from.
 */
const FORBIDDEN = [
  "pedigree",
  "bakers",
  "dentastix",
  "markies",
  "jumbone",
  "purina",
  "wagg",
  "harringtons",
  "winalot",
  "chappie",
  "butcher's",
  "lily's kitchen",
  "dreamies",
  "webbox",
];

/** This file names them all in order to forbid them, so it cannot scan itself. */
const SELF = "no-named-brands.test.ts";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|css)$/.test(entry) && entry !== SELF) out.push(full);
  }
  return out;
}

describe("no other company is named anywhere in src", () => {
  const files = walk(join(process.cwd(), "src"));

  it("finds files to check, so a broken walk cannot pass silently", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(FORBIDDEN)("never mentions %s", (brand) => {
    const offenders = files.filter((f) =>
      readFileSync(f, "utf8").toLowerCase().includes(brand),
    );
    expect(offenders).toEqual([]);
  });
});
