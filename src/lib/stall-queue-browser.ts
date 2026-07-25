// IndexedDB adapter for the stall queue. IndexedDB rather than localStorage because
// queued records carry a downscaled dog photo as a data URL, and a handful of those
// would blow through localStorage's ~5MB quota on exactly the busy Sunday when the
// queue must not fail. All rules live in stall-queue.ts; this file is plumbing.

import {
  normaliseQueueState,
  type StallQueueState,
  type StallQueueStorage,
} from "@/lib/stall-queue";

const DB_NAME = "br-stall";
const STORE = "queue";
const KEY = "state";

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

export function createBrowserQueueStorage(): StallQueueStorage {
  return {
    async load(): Promise<StallQueueState> {
      try {
        const db = await openDb();
        try {
          const raw = await requestToPromise(
            db.transaction(STORE, "readonly").objectStore(STORE).get(KEY),
          );
          return normaliseQueueState(raw);
        } finally {
          db.close();
        }
      } catch {
        return { records: [], syncedCount: 0 };
      }
    },

    async save(state: StallQueueState): Promise<void> {
      const db = await openDb();
      try {
        await requestToPromise(
          db.transaction(STORE, "readwrite").objectStore(STORE).put(state, KEY),
        );
      } finally {
        db.close();
      }
    },

    /**
     * End of day: clear the store, then delete the whole database, belt and braces,
     * because the iPad is borrowed and nothing personal may remain on it.
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
