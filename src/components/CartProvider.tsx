"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/data/products";
import {
  bundleDeliveryProduct,
  priceBundle,
  type BundleSelection,
  type BundleSize,
} from "@/lib/pick-and-mix";
import {
  computeBasketDelivery,
  type BasketDelivery,
  type DeliveryProduct,
} from "@/lib/shipping";

export interface CartLine {
  slug: string;
  qty: number;
  /** Present on a Pick & Mix line: the frozen draw the customer saw. */
  bundle?: BundleSelection;
}

interface CartCtx {
  lines: CartLine[];
  catalogue: Product[];
  count: number;
  subtotal: number;
  add: (slug: string) => void;
  addBundle: (size: BundleSize, items: string[]) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  delivery: (postcode: string) => BasketDelivery;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "barkingraw_cart_v1";

export function CartProvider({
  catalogue,
  children,
}: {
  catalogue: Product[];
  children: ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const add = (slug: string) =>
    setLines((prev) => {
      const existing = prev.find((l) => l.slug === slug);
      if (existing) return prev.map((l) => (l.slug === slug ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { slug, qty: 1 }];
    });

  // Each bundle is its own line under a minted id: a second identical draw is
  // still a separate line, and a re-roll is a remove plus a fresh add.
  const addBundle = (size: BundleSize, items: string[]) =>
    setLines((prev) => [
      ...prev,
      {
        slug: `pick-and-mix-${size}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        qty: 1,
        bundle: { size, items },
      },
    ]);

  // A bundle line's quantity is fixed at 1 (another bundle is another draw,
  // not qty 2); removal through qty <= 0 still works for every line.
  const setQty = (slug: string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.slug !== slug)
        : prev.map((l) => (l.slug === slug && !l.bundle ? { ...l, qty } : l)),
    );

  const remove = (slug: string) => setLines((prev) => prev.filter((l) => l.slug !== slug));
  const clear = () => setLines([]);

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  const bySlug = useMemo(() => new Map(catalogue.map((p) => [p.slug, p])), [catalogue]);

  const subtotal = useMemo(
    () =>
      lines.reduce((s, l) => {
        if (l.bundle) return s + (priceBundle(l.bundle.items, bySlug)?.price ?? 0);
        const p = bySlug.get(l.slug);
        return s + (p ? p.price * l.qty : 0);
      }, 0),
    [lines, bySlug],
  );

  // A bundle rides in Michaela's own parcel, priced at what the customer pays,
  // so the free-over-35 threshold counts the real money.
  const delivery = (postcode: string) =>
    computeBasketDelivery(
      lines
        .map((l): { product: DeliveryProduct | undefined; qty: number } => {
          if (l.bundle) {
            const priced = priceBundle(l.bundle.items, bySlug);
            return {
              product: priced
                ? bundleDeliveryProduct(l.slug, l.bundle.size, priced.price)
                : undefined,
              qty: 1,
            };
          }
          return { product: bySlug.get(l.slug), qty: l.qty };
        })
        .filter((i): i is { product: DeliveryProduct; qty: number } => Boolean(i.product)),
      postcode,
    );

  return (
    <Ctx.Provider
      value={{
        lines,
        catalogue,
        count,
        subtotal,
        add,
        addBundle,
        setQty,
        remove,
        clear,
        open,
        setOpen,
        delivery,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
