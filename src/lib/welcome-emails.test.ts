import { describe, it, expect } from "vitest";
import { STORY_TARGETS, codeWaitingEmail, storyEmail } from "./welcome-emails";

const args = { siteUrl: "https://barkingraw.dog", email: "sam@example.com", secret: "s" };

describe("STORY_TARGETS", () => {
  it("builds the case on About, then sends the reader to the shop", () => {
    expect(STORY_TARGETS).toHaveLength(4);
    expect(STORY_TARGETS.slice(0, 3).map((t) => t.path)).toEqual(["/about", "/about", "/about"]);
    expect(STORY_TARGETS[3].path).toBe("/shop");
  });

  it("points at no page that has been deleted", () => {
    for (const t of STORY_TARGETS) {
      expect(["/good-food", "/comfy-walks", "/fun-and-games", "/cosy-sleep"]).not.toContain(t.path);
    }
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

describe("storyEmail", () => {
  it("each carries its own subject and links to its page", () => {
    for (const i of [0, 1, 2, 3] as const) {
      const e = storyEmail(i, args);
      expect(e.subject).toBeTruthy();
      expect(e.html).toContain(`https://barkingraw.dog${STORY_TARGETS[i].path}`);
      expect(e.html).toContain("/api/unsubscribe?e=sam%40example.com&t=");
    }
  });
  it("keeps the house style: no em dashes anywhere", () => {
    const emDash = String.fromCharCode(0x2014);
    for (const i of [0, 1, 2, 3] as const) {
      const e = storyEmail(i, args);
      expect(e.subject.includes(emDash)).toBe(false);
      expect(e.html.includes(emDash)).toBe(false);
    }
    const code = codeWaitingEmail({ code: "BR10ABCDE", ...args });
    expect(code.html.includes(emDash)).toBe(false);
  });
  it("stays inside the dossier: no wolf claims, no dewormer myth, no scare words", () => {
    for (const i of [0, 1, 2, 3] as const) {
      const html = storyEmail(i, args).html.toLowerCase();
      for (const banned of ["wolves", "wolf", "dewormer", "kills", "poison", "toxic"]) {
        expect(html.includes(banned)).toBe(false);
      }
    }
  });
});
