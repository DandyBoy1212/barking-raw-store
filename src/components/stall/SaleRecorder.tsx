"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  emptyQueue,
  enqueueRecord,
  queueSummary,
  syncQueue,
  type QueueState,
  type StallSyncOutcome,
} from "@/lib/stall-queue";
import { createBrowserQueueStorage } from "@/lib/stall-queue-browser";
import type { StallSale } from "@/lib/stall-sale";
import { gbp } from "@/lib/format";

export type SaleProductOption = { slug: string; name: string; price: number };
export type SaleMemberOption = { uid: string; name: string; email: string };

/**
 * The stall sale recorder, spec 10.1.2: pick the member, pick the products,
 * cash or card, save. Saved locally first and synced when signal allows, the
 * same queue machinery as the signup form (storage key "sales", one shared
 * database, so the signup page's end-of-day wipe clears this queue too). The
 * catalogue and member list are a page-load snapshot: the page is opened with
 * signal at set-up, then works offline all day. Prices shown here are only a
 * running estimate; the server prices every line from the product docs.
 */
export default function SaleRecorder({
  products,
  members,
}: {
  products: SaleProductOption[];
  members: SaleMemberOption[];
}) {
  const storageRef = useRef(createBrowserQueueStorage<StallSale>("sales"));
  const syncingRef = useRef(false);
  const queueRef = useRef<QueueState<StallSale>>(emptyQueue<StallSale>());
  const [queue, setQueueState] = useState<QueueState<StallSale>>(emptyQueue<StallSale>());
  const [search, setSearch] = useState("");
  const [member, setMember] = useState<SaleMemberOption | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<"cash" | "card" | "">("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");

  const setQueue = useCallback((state: QueueState<StallSale>) => {
    queueRef.current = state;
    setQueueState(state);
  }, []);

  /** Post one sale; map the response onto a queue outcome. */
  const sender = useCallback(async (sale: StallSale): Promise<StallSyncOutcome> => {
    const res = await fetch("/api/stall/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sale),
    });
    if (res.ok) return "synced";
    if (res.status === 401) {
      setSessionEnded(true);
      return "retry";
    }
    return res.status === 400 ? "rejected" : "retry";
  }, []);

  const runSync = useCallback(
    async (includeFailed: boolean) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const after = await syncQueue(queueRef.current, sender, includeFailed);
        setQueue(after);
        try {
          await storageRef.current.save(after);
        } catch {
          setStorageWarning("Saving to this iPad is not working. Do not close this tab.");
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [sender, setQueue],
  );

  // Load the queue, then try a sync; keep trying whenever signal comes back.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await storageRef.current.load();
      if (cancelled) return;
      setQueue(loaded);
      void runSync(false);
    })();
    const onOnline = () => void runSync(false);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [runSync, setQueue]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, search]);

  const lines = products
    .map((p) => ({ ...p, qty: quantities[p.slug] ?? 0 }))
    .filter((p) => p.qty > 0);
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const canSave = lines.length > 0 && payment !== "" && (member !== null || noAccount);

  function bump(slug: string, delta: number) {
    setQuantities((q) => {
      const next = Math.max(0, Math.min(99, (q[slug] ?? 0) + delta));
      return { ...q, [slug]: next };
    });
  }

  async function save() {
    // canSave demands a payment method, and TypeScript narrows payment through it.
    if (!canSave) return;
    const sale: StallSale = {
      clientId: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      customer: {
        uid: member?.uid ?? "",
        email: member?.email ?? "",
        name: member?.name ?? "",
      },
      lines: lines.map((l) => ({ slug: l.slug, qty: l.qty })),
      payment,
    };

    // Local first, always: the queue in memory and on disk before any network.
    const after = enqueueRecord(queueRef.current, sale);
    setQueue(after);
    try {
      await storageRef.current.save(after);
    } catch {
      setStorageWarning("Saving to this iPad is not working. Do not close this tab.");
    }
    setQuantities({});
    setPayment("");
    setMember(null);
    setNoAccount(false);
    setSearch("");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 4000);
    void runSync(false);
  }

  const summary = queueSummary(queue);
  const bigBtn = { fontSize: "1.05rem", padding: "0.9rem 1.2rem" } as const;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/stall">Back to signups</Link>
      </p>
      <p className="notice" aria-live="polite" style={{ marginBottom: "1.2rem" }}>
        {summary.label}
        {summary.failed > 0 && " Use Sync now below."}
      </p>
      {savedFlash && (
        <p className="notice" role="status" style={{ marginBottom: "1.2rem" }}>
          Sale saved on this iPad. It syncs itself when there is signal.
        </p>
      )}
      {sessionEnded && (
        <p className="form-error" role="alert" style={{ marginBottom: "1.2rem" }}>
          The stall session has ended. Sales are safe on this iPad. Reload this page and
          enter the PIN to carry on syncing.
        </p>
      )}
      {storageWarning && (
        <p className="form-error" role="alert" style={{ marginBottom: "1.2rem" }}>
          {storageWarning}
        </p>
      )}

      <div className="panel" style={{ marginBottom: "1.2rem" }}>
        <p className="panel__title">Who bought it?</p>
        {member ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <span className="chip">{member.name || member.email}</span>
            <button className="btn" type="button" style={bigBtn} onClick={() => setMember(null)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <label className="field">
              <span>Search by name or email</span>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setNoAccount(false);
                }}
                style={{ fontSize: "1.15rem", padding: "0.8rem" }}
              />
            </label>
            {matches.map((m) => (
              <button
                key={m.uid}
                className="chip"
                type="button"
                style={{ margin: "0.25rem 0.4rem 0.25rem 0", padding: "0.7rem 1rem" }}
                onClick={() => {
                  setMember(m);
                  setSearch("");
                }}
              >
                {m.name || "(no name)"} {m.email && <small>{m.email}</small>}
              </button>
            ))}
            <p style={{ marginTop: "0.8rem" }}>
              <button
                className="chip"
                type="button"
                aria-pressed={noAccount}
                style={{ padding: "0.7rem 1rem" }}
                onClick={() => setNoAccount((v) => !v)}
              >
                No account, just record the sale
              </button>
            </p>
          </>
        )}
      </div>

      <div className="panel" style={{ marginBottom: "1.2rem" }}>
        <p className="panel__title">What did they buy?</p>
        {products.map((p) => {
          const qty = quantities[p.slug] ?? 0;
          return (
            <div
              key={p.slug}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.7rem",
                padding: "0.45rem 0",
              }}
            >
              <span style={{ flex: 1 }}>
                {p.name} <small>{gbp(p.price)}</small>
              </span>
              <button
                className="btn"
                type="button"
                aria-label={`One fewer ${p.name}`}
                style={bigBtn}
                onClick={() => bump(p.slug, -1)}
              >
                -
              </button>
              <span style={{ minWidth: "2ch", textAlign: "center", fontWeight: 800 }}>{qty}</span>
              <button
                className="btn"
                type="button"
                aria-label={`One more ${p.name}`}
                style={bigBtn}
                onClick={() => bump(p.slug, 1)}
              >
                +
              </button>
            </div>
          );
        })}
        {products.length === 0 && <p>No products loaded. Open this page with signal first.</p>}
      </div>

      <div className="panel">
        <p className="panel__title">How was it paid?</p>
        <div className="chips">
          {(["cash", "card"] as const).map((method) => (
            <button
              key={method}
              className="chip"
              type="button"
              aria-pressed={payment === method}
              style={{ fontSize: "1rem", padding: "0.85rem 1.4rem" }}
              onClick={() => setPayment(payment === method ? "" : method)}
            >
              {method === "cash" ? "Cash" : "Card"}
            </button>
          ))}
        </div>
        <p style={{ marginTop: "1rem", fontWeight: 800 }}>About {gbp(total)}</p>
        <p style={{ marginTop: "1rem" }}>
          <button
            className="btn btn--solid-ink btn--block"
            type="button"
            disabled={!canSave}
            style={{ fontSize: "1.2rem", padding: "1.1rem" }}
            onClick={() => void save()}
          >
            Save this sale
          </button>
        </p>
        <div style={{ display: "flex", gap: "0.7rem", marginTop: "0.6rem" }}>
          <button className="btn" type="button" style={bigBtn} onClick={() => void runSync(true)}>
            Sync now
          </button>
        </div>
      </div>
    </div>
  );
}
