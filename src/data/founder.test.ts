import { describe, it, expect } from "vitest";
import {
  FOUNDER,
  founderDetail,
  founderDetailsPending,
  pendingFounderFields,
} from "./founder";
import { PENDING } from "./business";

describe("pendingFounderFields", () => {
  it("keeps the sign-off outstanding even though the story is drafted", () => {
    // The story on the page was supplied by Liam, not by Michaela. Until she
    // has read it and chosen how much of the personal background stays in,
    // the page is a draft and the notice must say so.
    const missing = pendingFounderFields();
    expect(missing).toContain(
      "her sign-off on the story as written, including how much of the personal background stays in"
    );
  });

  it("lists the two course names nobody has supplied", () => {
    const missing = pendingFounderFields();
    expect(missing).toContain(
      "the name and provider of the Tellington TTouch course she is working through"
    );
    expect(missing).toContain(
      "the name and provider of the canine nutrition course she is working through"
    );
  });

  it("puts the sign-off first, because it gates everything else on the page", () => {
    expect(pendingFounderFields()[0]).toBe(
      "her sign-off on the story as written, including how much of the personal background stays in"
    );
  });
});

describe("founderDetailsPending", () => {
  it("is true while anything is missing, so the draft notice cannot clear early", () => {
    expect(founderDetailsPending()).toBe(true);
  });
});

describe("founderDetail", () => {
  it("returns a visible placeholder for a pending value, never the sentinel", () => {
    expect(FOUNDER.ttouchCourse).toBe(PENDING);
    expect(founderDetail("ttouchCourse")).toBe("[to be confirmed]");
  });

  it("returns the real value once one exists", () => {
    expect(founderDetail("firstName")).toBe("Michaela");
  });
});
