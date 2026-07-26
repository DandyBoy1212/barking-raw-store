import { describe, it, expect } from "vitest";
import {
  EMPTY_QUEUE,
  enqueueRecord,
  normaliseQueueState,
  queueSummary,
  syncQueue,
  type StallQueueState,
} from "./stall-queue";
import type { StallRecord } from "./stall-record";

function record(clientId: string): StallRecord {
  return {
    clientId,
    capturedAt: "2026-07-26T09:00:00.000Z",
    name: "Sam",
    email: "",
    phone: "",
    address: { line1: "", line2: "", city: "", postcode: "" },
    dogs: [],
    consent: { marketing: false, photo: false },
  };
}

describe("enqueueRecord", () => {
  it("appends a record as waiting with zero attempts", () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    expect(state.records).toEqual([{ record: record("id-0000-1"), attempts: 0, failed: false }]);
  });

  it("replaces a record with the same clientId rather than queueing it twice", () => {
    const once = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const twice = enqueueRecord(once, { ...record("id-0000-1"), name: "Samantha" });
    expect(twice.records).toHaveLength(1);
    expect(twice.records[0].record.name).toBe("Samantha");
  });

  it("does not mutate the state it was given", () => {
    const state: StallQueueState = { records: [], syncedCount: 0 };
    enqueueRecord(state, record("id-0000-1"));
    expect(state.records).toHaveLength(0);
  });
});

describe("queueSummary", () => {
  it("says nothing is saved yet on an empty queue", () => {
    expect(queueSummary(EMPTY_QUEUE).label).toBe("Nothing saved yet");
  });

  it("counts saved and waiting the way Michaela reads them at the table", () => {
    let state: StallQueueState = { records: [], syncedCount: 2 };
    state = enqueueRecord(state, record("id-0000-1"));
    const summary = queueSummary(state);
    expect(summary).toEqual({
      waiting: 1,
      failed: 0,
      synced: 2,
      label: "3 saved, 1 waiting to sync",
    });
  });

  it("says all synced when the queue is drained", () => {
    expect(queueSummary({ records: [], syncedCount: 4 }).label).toBe("All 4 saved and synced");
  });

  it("counts a failed record separately so it is visible rather than silently stuck", () => {
    const state: StallQueueState = {
      records: [{ record: record("id-0000-1"), attempts: 3, failed: true }],
      syncedCount: 0,
    };
    const summary = queueSummary(state);
    expect(summary.failed).toBe(1);
    expect(summary.label).toBe("1 saved, 1 waiting to sync (1 needs a second go)");
  });
});

describe("syncQueue", () => {
  it("removes a synced record and keeps only the count, so nothing personal outlives a sync", async () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const after = await syncQueue(state, async () => "synced");
    expect(after.records).toHaveLength(0);
    expect(after.syncedCount).toBe(1);
  });

  it("keeps a record the server could not take yet, counting the attempt", async () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const after = await syncQueue(state, async () => "retry");
    expect(after.records).toEqual([{ record: record("id-0000-1"), attempts: 1, failed: false }]);
  });

  it("keeps and flags a rejected record instead of losing it or retrying it forever", async () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const after = await syncQueue(state, async () => "rejected");
    expect(after.records).toEqual([{ record: record("id-0000-1"), attempts: 1, failed: true }]);
  });

  it("treats a thrown sender as retry, because no signal must never lose a record", async () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const after = await syncQueue(state, async () => {
      throw new Error("offline");
    });
    expect(after.records).toEqual([{ record: record("id-0000-1"), attempts: 1, failed: false }]);
  });

  it("skips failed records on an automatic pass and includes them on a manual one", async () => {
    let state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    state = { ...state, records: [{ ...state.records[0], failed: true }] };
    const sent: string[] = [];
    const sender = async (r: StallRecord) => {
      sent.push(r.clientId);
      return "synced" as const;
    };
    const auto = await syncQueue(state, sender);
    expect(sent).toEqual([]);
    expect(auto.records).toHaveLength(1);
    const manual = await syncQueue(state, sender, true);
    expect(sent).toEqual(["id-0000-1"]);
    expect(manual.records).toHaveLength(0);
  });

  it("continues past a retry to sync the records behind it", async () => {
    let state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    state = enqueueRecord(state, record("id-0000-2"));
    const after = await syncQueue(state, async (r) =>
      r.clientId === "id-0000-1" ? "retry" : "synced",
    );
    expect(after.records.map((q) => q.record.clientId)).toEqual(["id-0000-1"]);
    expect(after.syncedCount).toBe(1);
  });
});

describe("normaliseQueueState", () => {
  it("returns an empty queue for anything unreadable rather than throwing", () => {
    expect(normaliseQueueState(undefined)).toEqual(EMPTY_QUEUE);
    expect(normaliseQueueState("junk")).toEqual(EMPTY_QUEUE);
    expect(normaliseQueueState({ records: "junk", syncedCount: "many" })).toEqual(EMPTY_QUEUE);
  });

  it("keeps well-formed entries and drops the rest", () => {
    const state = normaliseQueueState({
      records: [
        { record: record("id-0000-1"), attempts: 2, failed: false },
        { notARecord: true },
      ],
      syncedCount: 3,
    });
    expect(state.records).toEqual([{ record: record("id-0000-1"), attempts: 2, failed: false }]);
    expect(state.syncedCount).toBe(3);
  });
});
