import { ALL_BADGES, type Badge } from "@/data/products";

export { ALL_BADGES };

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ProductInput = {
  name: string;
  price: number;
  hook: string;
  description: string;
  badges: Badge[];
  image: string;
  safetyNote?: string;
};

export function validateProductInput(
  input: Partial<ProductInput>,
): { ok: true; value: ProductInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = String(input.name ?? "").trim();
  const price = Number(input.price ?? 0);
  const hook = String(input.hook ?? "").trim();
  const description = String(input.description ?? "").trim();
  const image = String(input.image ?? "").trim();
  const badges = Array.isArray(input.badges) ? (input.badges as Badge[]) : [];
  const safetyNote = input.safetyNote ? String(input.safetyNote).trim() : undefined;

  if (!name) errors.push("Name is required.");
  if (!(price > 0)) errors.push("Price must be greater than 0.");
  if (!hook) errors.push("Hook is required.");
  if (!description) errors.push("Description is required.");
  if (!image) errors.push("An image is required.");

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, price, hook, description, badges, image, safetyNote } };
}
