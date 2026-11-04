export type StoredSnapshot = { raw: string | null; revision: string | null };

/**
 * IndexedDB is authoritative. localStorage is only a legacy migration source
 * and compatibility mirror: its cross-renderer cache is not a compare-and-swap.
 * The callback must stay synchronous so its read/decision/write is one transaction.
 */
export function progressTransaction<T>(
  key: string,
  decide: (current: StoredSnapshot | undefined) => { value: T; write?: StoredSnapshot },
): Promise<T> {
  return new Promise((resolve, reject) => {
    let db: IDBDatabase | undefined;
    let tx: IDBTransaction | undefined;
    let settled = false;
    const finish = (error?: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db?.close();
      if (error) reject(error);
      else resolve(value as T);
    };
    const timer = setTimeout(() => {
      try { tx?.abort(); } catch { /* Already completed; still settle below. */ }
      finish(new Error('Progress storage timed out'));
    }, 5000);
    try {
      const request = indexedDB.open('funademy.lab.progress', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('lessons');
      request.onerror = () => finish(request.error);
      request.onblocked = () => finish(new Error('Progress storage upgrade blocked'));
      request.onsuccess = () => {
        db = request.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => db?.close();
        try {
          tx = db.transaction('lessons', 'readwrite');
          let result: T;
          tx.oncomplete = () => finish(undefined, result);
          tx.onabort = () => finish(tx?.error ?? new Error('Progress transaction aborted'));
          const store = tx.objectStore('lessons');
          const read = store.get(key);
          read.onsuccess = () => {
            try {
              const decision = decide(read.result as StoredSnapshot | undefined);
              result = decision.value;
              if (decision.write) store.put(decision.write, key);
            } catch (error) {
              tx?.abort();
              finish(error);
            }
          };
        } catch (error) { finish(error); }
      };
    } catch (error) { finish(error); }
  });
}
