// IndexedDB adapter for the stall queues. IndexedDB rather than localStorage because
// queued records carry a downscaled dog photo as a data URL, and a handful of those
// would blow through localStorage's ~5MB quota on exactly the busy Sunday when the
// queue must not fail. All rules live in stall-queue.ts; this file is plumbing.
//
// Every queue (signups under "state", sales under "sales") lives in ONE database on
// purpose: wipe() deletes the whole database, so one end-of-day tap clears every
// record type from the borrowed iPad, including any queue added later.

import {
  normaliseQueueState,
  type QueueRecord,
  type QueueState,
  type QueueStorage,
} from "@/lib/stall-queue";

const DB_NAME = "br-stall";
const STORE = "queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createBrowserQueueStorage<T extends QueueRecord>(
  key = "state",
): QueueStorage<T> {
  return {
    async load(): Promise<QueueState<T>> {
      try {
        const db = await openDb();
        try {
          const raw = await requestToPromise(
            db.transaction(STORE, "readonly").objectStore(STORE).get(key),
          );
          return normaliseQueueState<T>(raw);
        } finally {
          db.close();
        }
      } catch {
        return { records: [], syncedCount: 0 };
      }
    },

    async save(state: QueueState<T>): Promise<void> {
      const db = await openDb();
      try {
        await requestToPromise(
          db.transaction(STORE, "readwrite").objectStore(STORE).put(state, key),
        );
      } finally {
        db.close();
      }
    },

    /**
     * End of day: clear the store, then delete the whole database, belt and braces,
     * because the iPad is borrowed and nothing personal may remain on it. Deleting
     * the database wipes EVERY queue, whichever key this storage was made with.
     */
    async wipe(): Promise<void> {
      try {
        const db = await openDb();
        try {
          await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).clear());
        } finally {
          db.close();
        }
      } catch {
        // Fall through to the delete, which is the wipe that matters.
      }
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    },
  };
}
