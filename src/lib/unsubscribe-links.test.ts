import { describe, it, expect } from "vitest";
import { unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from "./unsubscribe-links";

describe("unsubscribe tokens", () => {
  it("verifies its own token", () => {
    const t = unsubscribeToken("sam@example.com", "s3cret");
    expect(verifyUnsubscribeToken("sam@example.com", t, "s3cret")).toBe(true);
  });
  it("is case-insensitive on the email, matching the dedup key", () => {
    const t = unsubscribeToken("Sam@Example.com", "s3cret");
    expect(verifyUnsubscribeToken("sam@example.com", t, "s3cret")).toBe(true);
  });
  it("rejects a forged token, a wrong email, and a wrong secret", () => {
    const t = unsubscribeToken("sam@example.com", "s3cret");
    expect(verifyUnsubscribeToken("sam@example.com", "deadbeef", "s3cret")).toBe(false);
    expect(verifyUnsubscribeToken("eve@example.com", t, "s3cret")).toBe(false);
    expect(verifyUnsubscribeToken("sam@example.com", t, "other")).toBe(false);
  });
  it("rejects garbage tokens rather than throwing", () => {
    expect(verifyUnsubscribeToken("sam@example.com", "", "s3cret")).toBe(false);
    expect(verifyUnsubscribeToken("sam@example.com", "zz not hex", "s3cret")).toBe(false);
  });
  it("builds the link the email footer carries", () => {
    const url = unsubscribeUrl("https://barkingraw.dog", "sam+dog@example.com", "s3cret");
    expect(
      url.startsWith("https://barkingraw.dog/api/unsubscribe?e=sam%2Bdog%40example.com&t="),
    ).toBe(true);
  });
  it("strips a trailing slash from the site url", () => {
    const url = unsubscribeUrl("https://barkingraw.dog/", "a@b.co", "s");
    expect(url.includes(".dog/api/")).toBe(true);
    expect(url.includes("//api/")).toBe(false);
  });
});
