type CacheEntry<T> = { expiresAt: number; value: T };

export function createReadThroughCache<T>(ttlMs = 60_000) {
  let cached: CacheEntry<T> | undefined;
  let inFlight: Promise<T> | undefined;
  return async (load: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value;
    if (inFlight) return inFlight;
    inFlight = load()
      .then((value) => {
        cached = { expiresAt: Date.now() + ttlMs, value };
        return value;
      })
      .finally(() => { inFlight = undefined; });
    return inFlight;
  };
}

export function createKeyedReadThroughCache<Key, Value>(ttlMs = 60_000, maxEntries = 500) {
  const cached = new Map<Key, CacheEntry<Value>>();
  const inFlight = new Map<Key, Promise<Value>>();
  return async (key: Key, load: () => Promise<Value>): Promise<Value> => {
    const now = Date.now();
    const entry = cached.get(key);
    if (entry && entry.expiresAt > now) return entry.value;
    const pending = inFlight.get(key);
    if (pending) return pending;
    const request = load()
      .then((value) => {
        if (cached.size >= maxEntries) cached.delete(cached.keys().next().value as Key);
        cached.set(key, { expiresAt: Date.now() + ttlMs, value });
        return value;
      })
      .finally(() => { inFlight.delete(key); });
    inFlight.set(key, request);
    return request;
  };
}
