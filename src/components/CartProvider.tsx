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
import { computeBasketDelivery, type BasketDelivery } from "@/lib/shipping";

export interface CartLine {
  slug: string;
  qty: number;
}

interface CartCtx {
  lines: CartLine[];
  catalogue: Product[];
  count: number;
  subtotal: number;
  add: (slug: string) => void;
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

  const setQty = (slug: string, qty: number) =>
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.slug !== slug) : prev.map((l) => (l.slug === slug ? { ...l, qty } : l)),
    );

  const remove = (slug: string) => setLines((prev) => prev.filter((l) => l.slug !== slug));
  const clear = () => setLines([]);

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  const bySlug = useMemo(() => new Map(catalogue.map((p) => [p.slug, p])), [catalogue]);

  const subtotal = useMemo(
    () =>
      lines.reduce((s, l) => {
        const p = bySlug.get(l.slug);
        return s + (p ? p.price * l.qty : 0);
      }, 0),
    [lines, bySlug],
  );

  const delivery = (postcode: string) =>
    computeBasketDelivery(
      lines
        .map((l) => ({ product: bySlug.get(l.slug), qty: l.qty }))
        .filter((i): i is { product: Product; qty: number } => Boolean(i.product)),
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
