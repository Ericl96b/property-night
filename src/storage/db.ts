// Tiny IndexedDB key-value layer (SPEC §2 data, §12 storage/). Falls back to memory when
// IndexedDB is unavailable (private windows, tests) so the app always works.

export type StoreName = 'presets' | 'saves' | 'meta';
const STORES: StoreName[] = ['presets', 'saves', 'meta'];
const DB_NAME = 'property-night';
const VERSION = 1;

export interface KV {
  list<T>(store: StoreName): Promise<T[]>;
  get<T>(store: StoreName, id: string): Promise<T | undefined>;
  put<T extends { id: string }>(store: StoreName, value: T): Promise<void>;
  delete(store: StoreName, id: string): Promise<void>;
}

export function memoryKV(): KV {
  const data = new Map<StoreName, Map<string, unknown>>(STORES.map((s) => [s, new Map()]));
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    async list<T>(store: StoreName) {
      return [...data.get(store)!.values()].map((v) => clone(v as T));
    },
    async get<T>(store: StoreName, id: string) {
      const v = data.get(store)!.get(id);
      return v === undefined ? undefined : clone(v as T);
    },
    async put(store, value) {
      data.get(store)!.set(value.id, clone(value));
    },
    async delete(store, id) {
      data.get(store)!.delete(id);
    },
  };
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function openKV(): Promise<KV> {
  if (typeof indexedDB === 'undefined') return memoryKV();
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = () => {
        for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('blocked'));
    });
    const tx = (store: StoreName, mode: IDBTransactionMode) => db.transaction(store, mode).objectStore(store);
    return {
      list: async <T>(store: StoreName) => (await req(tx(store, 'readonly').getAll())) as T[],
      get: async <T>(store: StoreName, id: string) => (await req(tx(store, 'readonly').get(id))) as T | undefined,
      put: async (store, value) => void (await req(tx(store, 'readwrite').put(value))),
      delete: async (store, id) => void (await req(tx(store, 'readwrite').delete(id))),
    };
  } catch {
    return memoryKV();
  }
}
