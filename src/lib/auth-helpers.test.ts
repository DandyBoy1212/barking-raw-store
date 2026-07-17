import { describe, it, expect } from "vitest";
import {
  decodedToSessionUser,
  buildActionCodeSettings,
  signInEmailHtml,
  buildCustomerDoc,
  SESSION_MAX_AGE_MS,
} from "./auth-helpers";

describe("decodedToSessionUser", () => {
  it("maps uid and email and treats staff:true as staff", () => {
    expect(decodedToSessionUser({ uid: "u1", email: "a@b.com", staff: true }))
      .toEqual({ uid: "u1", email: "a@b.com", staff: true });
  });
  it("defaults email to empty and staff to false for anything but true", () => {
    expect(decodedToSessionUser({ uid: "u2" })).toEqual({ uid: "u2", email: "", staff: false });
    expect(decodedToSessionUser({ uid: "u3", staff: "yes" }).staff).toBe(false);
  });
});

describe("buildActionCodeSettings", () => {
  it("points the continue url at /login/complete and trims a trailing slash", () => {
    expect(buildActionCodeSettings("https://barkingraw.dog/")).toEqual({
      url: "https://barkingraw.dog/login/complete",
      handleCodeInApp: true,
    });
  });
});

describe("signInEmailHtml", () => {
  it("includes the link and greets by name when given", () => {
    const html = signInEmailHtml("https://x/y", "Michaela");
    expect(html).toContain("https://x/y");
    expect(html).toContain("Hi Michaela,");
    expect(signInEmailHtml("https://x/y")).toContain("Hi,");
  });
});

describe("buildCustomerDoc", () => {
  it("normalises fields with sensible blanks", () => {
    expect(buildCustomerDoc({ email: "a@b.com", name: "Sam", postcode: "DD1 1AA" }))
      .toEqual({ email: "a@b.com", name: "Sam", lastPostcode: "DD1 1AA" });
    expect(buildCustomerDoc({ email: "a@b.com" }))
      .toEqual({ email: "a@b.com", name: "", lastPostcode: "" });
  });
});

describe("constants", () => {
  it("session lasts 14 days", () => {
    expect(SESSION_MAX_AGE_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});
