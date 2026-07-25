import { describe, it, expect } from "vitest";
import { PILLARS, codeWaitingEmail, pillarEmail } from "./welcome-emails";

const args = { siteUrl: "https://barkingraw.dog", email: "sam@example.com", secret: "s" };

describe("PILLARS", () => {
  it("is the four pillars, in ring order, at their agreed paths", () => {
    expect(PILLARS.map((p) => p.name)).toEqual([
      "Good Food",
      "Comfy Walks",
      "Fun & Games",
      "Cosy Sleep",
    ]);
    expect(PILLARS.map((p) => p.path)).toEqual([
      "/good-food",
      "/comfy-walks",
      "/fun-and-games",
      "/cosy-sleep",
    ]);
  });
});

describe("codeWaitingEmail", () => {
  it("carries the code and a link to the shop", () => {
    const e = codeWaitingEmail({ code: "BR10ABCDE", ...args });
    expect(e.subject.toLowerCase()).toContain("code");
    expect(e.html).toContain("BR10ABCDE");
    expect(e.html).toContain("https://barkingraw.dog");
  });
  it("carries a working unsubscribe link", () => {
    const e = codeWaitingEmail({ code: "BR10ABCDE", ...args });
    expect(e.html).toContain("/api/unsubscribe?e=sam%40example.com&t=");
  });
});

describe("pillarEmail", () => {
  it("each teaches its own pillar and links to its page", () => {
    for (const i of [0, 1, 2, 3] as const) {
      const e = pillarEmail(i, args);
      expect(e.subject).toBeTruthy();
      expect(e.html).toContain(`https://barkingraw.dog${PILLARS[i].path}`);
      expect(e.html).toContain("/api/unsubscribe?e=sam%40example.com&t=");
    }
  });
  it("keeps the house style: no em dashes anywhere", () => {
    for (const i of [0, 1, 2, 3] as const) {
      const e = pillarEmail(i, args);
      expect(e.subject.includes("—")).toBe(false);
      expect(e.html.includes("—")).toBe(false);
    }
    const code = codeWaitingEmail({ code: "BR10ABCDE", ...args });
    expect(code.html.includes("—")).toBe(false);
  });
  it("stays inside the dossier: no wolf claims, no dewormer myth, no scare words", () => {
    for (const i of [0, 1, 2, 3] as const) {
      const html = pillarEmail(i, args).html.toLowerCase();
      for (const banned of ["wolves", "wolf", "dewormer", "kills", "poison", "toxic"]) {
        expect(html.includes(banned)).toBe(false);
      }
    }
  });
});
