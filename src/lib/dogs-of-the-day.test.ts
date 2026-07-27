import { describe, it, expect } from "vitest";
import {
  consentedDogPhotos,
  docToDogFeature,
  sortFeaturesNewestFirst,
  usableDogPhoto,
  validateDogFeatureInput,
  type DogFeature,
} from "./dogs-of-the-day";

const OWN = "https://storage.googleapis.com/bucket/dogs/u1/loki.jpg?sig=abc";
const TODAY = "2026-07-26";

describe("usableDogPhoto", () => {
  it("passes a signed URL on our own storage host", () => {
    expect(usableDogPhoto(OWN)).toBe(OWN);
  });

  it("refuses foreign hosts, plain http, javascript and junk", () => {
    expect(usableDogPhoto("https://evil.example/x.jpg")).toBe("");
    expect(usableDogPhoto("http://storage.googleapis.com/bucket/x.jpg")).toBe("");
    expect(usableDogPhoto("javascript:alert(1)")).toBe("");
    expect(usableDogPhoto("")).toBe("");
    expect(usableDogPhoto(undefined)).toBe("");
    expect(usableDogPhoto(42)).toBe("");
  });
});

describe("validateDogFeatureInput", () => {
  it("accepts a named dog with an own-storage photo", () => {
    const result = validateDogFeatureInput(
      { dogName: "  Loki ", photo: OWN, date: "2026-07-20" },
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      value: { dogName: "Loki", photo: OWN, date: "2026-07-20" },
    });
  });

  it("requires the dog's name", () => {
    const result = validateDogFeatureInput({ photo: OWN }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("The dog needs its name.");
  });

  it("refuses a photo that is not on our own storage", () => {
    const result = validateDogFeatureInput(
      { dogName: "Loki", photo: "https://evil.example/x.jpg" },
      TODAY,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("The photo must live on our own storage.");
  });

  it("falls back to today when the date is missing or junk", () => {
    const result = validateDogFeatureInput({ dogName: "Loki", photo: OWN, date: "soonish" }, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.date).toBe(TODAY);
  });

  it("refuses a non-object body", () => {
    expect(validateDogFeatureInput(null, TODAY).ok).toBe(false);
    expect(validateDogFeatureInput("stuff", TODAY).ok).toBe(false);
  });
});

describe("docToDogFeature", () => {
  it("maps a good doc", () => {
    expect(docToDogFeature("f1", { dogName: "Loki", photo: OWN, date: "2026-07-20" })).toEqual({
      id: "f1",
      dogName: "Loki",
      photo: OWN,
      date: "2026-07-20",
    });
  });

  it("returns null for a foreign photo, so a hand-edited doc still cannot render", () => {
    expect(docToDogFeature("f1", { dogName: "Loki", photo: "https://evil.example/x.jpg" })).toBeNull();
  });

  it("returns null for a nameless or photoless doc", () => {
    expect(docToDogFeature("f1", { photo: OWN })).toBeNull();
    expect(docToDogFeature("f1", { dogName: "Loki" })).toBeNull();
  });
});

describe("sortFeaturesNewestFirst", () => {
  it("orders by date descending with the id as a stable tiebreak", () => {
    const features: DogFeature[] = [
      { id: "a", dogName: "Old", photo: OWN, date: "2026-07-01" },
      { id: "b", dogName: "New", photo: OWN, date: "2026-07-20" },
      { id: "c", dogName: "AlsoNew", photo: OWN, date: "2026-07-20" },
    ];
    expect(sortFeaturesNewestFirst(features).map((f) => f.id)).toEqual(["c", "b", "a"]);
  });
});

describe("consentedDogPhotos", () => {
  const dogs = [
    { id: "dog-1", name: "Loki", photo: OWN },
    { id: "dog-2", name: "Bear" },
    { id: "dog-3", name: "Rex", photo: "https://evil.example/x.jpg" },
  ];

  it("keeps only guard-passing dogs of strictly consented owners", () => {
    const result = consentedDogPhotos([
      { uid: "u1", data: { name: "Sam", photoConsent: true, dogs } },
      { uid: "u2", data: { name: "Ann", photoConsent: "true", dogs } },
      { uid: "u3", data: { name: "Jo", dogs } },
    ]);
    expect(result).toEqual([
      { uid: "u1", dogId: "dog-1", dogName: "Loki", photo: OWN, ownerName: "Sam" },
    ]);
  });

  it("never invents owner data and survives junk docs", () => {
    const result = consentedDogPhotos([
      { uid: "u1", data: { photoConsent: true, dogs: [{ id: "dog-1", name: "Loki", photo: OWN }] } },
      { uid: "u2", data: { photoConsent: true, dogs: "junk" } },
      { uid: "u3", data: { photoConsent: true } },
    ]);
    expect(result).toEqual([
      { uid: "u1", dogId: "dog-1", dogName: "Loki", photo: OWN, ownerName: "" },
    ]);
  });
});
