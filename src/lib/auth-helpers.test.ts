import { describe, it, expect } from "vitest";
import {
  decodedToSessionUser,
  buildActionCodeSettings,
  signInEmailHtml,
  buildCustomerDoc,
  isAllowedOrigin,
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

  it("escapes an unsafe name so it cannot inject markup", () => {
    const html = signInEmailHtml("https://x/y", "<img src=x onerror=alert(1)>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
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

describe("isAllowedOrigin", () => {
  const siteUrl = "https://barkingraw.dog";

  it("passes when the origin matches the site origin", () => {
    expect(isAllowedOrigin("https://barkingraw.dog", null, siteUrl)).toBe(true);
  });

  it("fails when the origin is an attacker origin", () => {
    expect(isAllowedOrigin("https://evil.example", null, siteUrl)).toBe(false);
  });

  it("falls back to the referer when origin is absent", () => {
    expect(isAllowedOrigin(null, "https://barkingraw.dog/login", siteUrl)).toBe(true);
    expect(isAllowedOrigin(null, "https://evil.example/x", siteUrl)).toBe(false);
  });

  it("rejects a referer whose host merely starts with the site origin", () => {
    expect(isAllowedOrigin(null, "https://barkingraw.dog.evil.example/x", siteUrl)).toBe(false);
    expect(isAllowedOrigin(null, "http://localhost:30001/x", siteUrl)).toBe(false);
  });

  it("accepts a bare same-origin referer with no path", () => {
    expect(isAllowedOrigin(null, "https://barkingraw.dog", siteUrl)).toBe(true);
  });

  it("passes when neither header is present (non-browser clients)", () => {
    expect(isAllowedOrigin(null, null, siteUrl)).toBe(true);
  });

  it("passes for the localhost dev origin regardless of siteUrl", () => {
    expect(isAllowedOrigin("http://localhost:3000", null, siteUrl)).toBe(true);
    expect(isAllowedOrigin(null, "http://localhost:3000/login", siteUrl)).toBe(true);
  });
});
