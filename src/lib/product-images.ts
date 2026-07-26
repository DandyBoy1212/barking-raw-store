// Pure image-list logic for a product's photos. No Firestore, no React, so this
// module is trivially unit-testable (mirrors product-fields.ts).

/** One photo of a product. Exactly one entry in a normalised list is primary. */
export type ProductImage = { url: string; primary: boolean };

/**
 * Canonicalise whatever a Firestore doc, an admin payload or the seed carries
 * into an ordered list with exactly one primary.
 *
 * Tolerated inputs: a proper list of { url, primary? }, a list of plain strings,
 * or nothing at all plus the legacy single `image` string. The first entry marked
 * primary wins; if none is marked, the first image is primary. Junk entries are
 * dropped rather than thrown, because a half-broken doc must not hide a product.
 */
export function normaliseImages(images: unknown, legacyImage?: unknown): ProductImage[] {
  const cleaned: ProductImage[] = [];
  if (Array.isArray(images)) {
    for (const entry of images) {
      const url =
        typeof entry === "string"
          ? entry.trim()
          : entry && typeof (entry as { url?: unknown }).url === "string"
            ? (entry as { url: string }).url.trim()
            : "";
      if (!url) continue;
      cleaned.push({ url, primary: (entry as { primary?: unknown })?.primary === true });
    }
  }
  if (cleaned.length === 0) {
    const legacy = typeof legacyImage === "string" ? legacyImage.trim() : "";
    if (!legacy) return [];
    return [{ url: legacy, primary: true }];
  }
  const first = cleaned.findIndex((i) => i.primary);
  const primaryAt = first === -1 ? 0 : first;
  return cleaned.map((i, n) => ({ url: i.url, primary: n === primaryAt }));
}

/** The primary image's URL: what Stripe, the basket and the fulfilment row use. */
export function primaryImageUrl(images: ProductImage[]): string {
  return images.find((i) => i.primary)?.url ?? images[0]?.url ?? "";
}

/** Mark the image at `index` primary. Out of range leaves the list untouched. */
export function setPrimary(images: ProductImage[], index: number): ProductImage[] {
  if (!Number.isInteger(index) || index < 0 || index >= images.length) return images;
  return images.map((i, n) => ({ url: i.url, primary: n === index }));
}

/** Move an image from one position to another, keeping the primary flag with it. */
export function moveImage(images: ProductImage[], from: number, to: number): ProductImage[] {
  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < images.length;
  if (!inRange(from) || !inRange(to)) return images;
  const next = images.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Remove the image at `index`. Removing the primary promotes the first remaining. */
export function removeImage(images: ProductImage[], index: number): ProductImage[] {
  if (!Number.isInteger(index) || index < 0 || index >= images.length) return images;
  return normaliseImages(images.filter((_, n) => n !== index));
}

/** Step a gallery index by `delta`, wrapping at both ends. */
export function cycleIndex(current: number, delta: number, length: number): number {
  if (length <= 1) return 0;
  return (((current + delta) % length) + length) % length;
}
