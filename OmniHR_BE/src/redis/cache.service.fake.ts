import { CacheService } from "./cache.service";

/**
 * In-memory stand-in for CacheService in unit tests.
 *
 * It keeps the real cache-aside semantics - a hit skips the loader, a miss
 * runs it and stores the result, and null is never stored - so a test can
 * assert how often the database was actually touched. TTLs are ignored;
 * expiry is Redis's job, not something these tests exercise.
 */
export function createFakeCache() {
  const store = new Map<string, unknown>();

  const cache = {
    async wrap<T>(key: string, _ttl: number, loader: () => Promise<T>) {
      if (store.has(key)) {
        return store.get(key) as T;
      }
      const value = await loader();
      if (value !== null && value !== undefined) {
        store.set(key, value);
      }
      return value;
    },
    async get<T>(key: string) {
      return store.has(key) ? (store.get(key) as T) : null;
    },
    async set<T>(key: string, value: T) {
      store.set(key, value);
    },
    async del(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        store.delete(key);
      }
    },
  };

  return { cache: cache as unknown as CacheService, store };
}
