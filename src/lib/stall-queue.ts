// The offline queue as a pure state machine. Storage (IndexedDB) and network (the
// sync route) sit behind the two interfaces below, so every rule here is tested
// with fakes, the way shipping.ts is tested (spec 10.1.1 calls offline-first the
// requirement most likely to sink the stall form, which is why it gets a module).

import type { StallRecord } from "@/lib/stall-record";

export type QueuedStallRecord = { record: StallRecord; attempts: number; failed: boolean };

export type StallQueueState = { records: QueuedStallRecord[]; syncedCount: number };

export const EMPTY_QUEUE: StallQueueState = { records: [], syncedCount: 0 };

/** Where the queue lives between page loads. The browser adapter uses IndexedDB. */
export interface StallQueueStorage {
  load(): Promise<StallQueueState>;
  save(state: StallQueueState): Promise<void>;
  wipe(): Promise<void>;
}

/**
 * What one sync attempt came to. "synced" removes the record, "retry" keeps it for
 * the next pass (no signal, server busy), "rejected" keeps it but flags it so a
 * record the server refuses outright stops burning the automatic retry loop and
 * waits for a manual sync instead. Nothing is ever dropped unsynced.
 */
export type StallSyncOutcome = "synced" | "retry" | "rejected";

export type StallSyncSender = (record: StallRecord) => Promise<StallSyncOutcome>;

/** Rebuild a queue from whatever storage returned, dropping only what is unreadable. */
export function normaliseQueueState(raw: unknown): StallQueueState {
  if (!raw || typeof raw !== "object") return { records: [], syncedCount: 0 };
  const data = raw as Record<string, unknown>;
  const records: QueuedStallRecord[] = Array.isArray(data.records)
    ? (data.records as unknown[])
        .filter((entry): entry is QueuedStallRecord => {
          if (!entry || typeof entry !== "object") return false;
          const q = entry as Partial<QueuedStallRecord>;
          return Boolean(q.record && typeof q.record === "object" && q.record.clientId);
        })
        .map((q) => ({ record: q.record, attempts: Number(q.attempts) || 0, failed: q.failed === true }))
    : [];
  const syncedCount = Number(data.syncedCount);
  return { records, syncedCount: Number.isFinite(syncedCount) && syncedCount > 0 ? syncedCount : 0 };
}

/** Add a record, replacing any queued record with the same clientId. Never mutates. */
export function enqueueRecord(state: StallQueueState, record: StallRecord): StallQueueState {
  const kept = state.records.filter((q) => q.record.clientId !== record.clientId);
  return { ...state, records: [...kept, { record, attempts: 0, failed: false }] };
}

/** The line Michaela reads at the table. Derived, so it can never drift from the truth. */
export function queueSummary(state: StallQueueState): {
  waiting: number;
  failed: number;
  synced: number;
  label: string;
} {
  const waiting = state.records.length;
  const failed = state.records.filter((q) => q.failed).length;
  const synced = state.syncedCount;
  const total = synced + waiting;
  let label: string;
  if (total === 0) label = "Nothing saved yet";
  else if (waiting === 0) label = `All ${total} saved and synced`;
  else {
    label = `${total} saved, ${waiting} waiting to sync`;
    if (failed) label += ` (${failed} need${failed === 1 ? "s" : ""} a second go)`;
  }
  return { waiting, failed, synced, label };
}

/**
 * One sync pass, sequential so a weak signal is not asked to carry six photos at
 * once. Failed records only go again when includeFailed is set (the manual button).
 * A thrown sender counts as retry: losing signal mid-request must never lose data.
 */
export async function syncQueue(
  state: StallQueueState,
  sender: StallSyncSender,
  includeFailed = false,
): Promise<StallQueueState> {
  let syncedCount = state.syncedCount;
  const remaining: QueuedStallRecord[] = [];

  for (const queued of state.records) {
    if (queued.failed && !includeFailed) {
      remaining.push(queued);
      continue;
    }
    let outcome: StallSyncOutcome;
    try {
      outcome = await sender(queued.record);
    } catch {
      outcome = "retry";
    }
    if (outcome === "synced") syncedCount += 1;
    else remaining.push({ ...queued, attempts: queued.attempts + 1, failed: outcome === "rejected" });
  }

  return { records: remaining, syncedCount };
}
