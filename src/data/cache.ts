/**
 * A tiny, versioned cache with explicit lifetimes.
 *
 * Weather is expensive to ask for and identical from one visit to the next
 * within a few minutes. We keep a fresh copy in memory and a second copy in
 * localStorage so a reload, or a return tomorrow, does not hammer Open-Meteo.
 *
 * Everything is namespaced and versioned: changing the shape of a cached value
 * is a breaking change, so a new prefix is cheaper than a migration.
 */

export interface CacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CacheOptions {
  /** Prefix for every key, including the schema version. */
  readonly namespace?: string;
  readonly storage?: CacheStorage;
  readonly now?: () => number;
}

export interface CacheHit<T> {
  readonly value: T;
  /** Age of the entry in milliseconds. */
  readonly ageMs: number;
  /** True while the entry is inside its lifetime. */
  readonly fresh: boolean;
}

interface CacheEntry<T> {
  readonly v: 1;
  readonly storedAt: number;
  readonly ttlMs: number;
  readonly value: T;
}

export const CACHE_NAMESPACE = 'atlas:v1';

/** A storage implementation for environments without localStorage, and for tests. */
export function createMemoryStorage(): CacheStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

function browserStorage(): CacheStorage {
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      const probe = `${CACHE_NAMESPACE}:probe`;
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    }
  } catch {
    // Private mode, disabled storage, or a sandboxed iframe.
  }
  return createMemoryStorage();
}

function isCacheEntry(value: unknown): value is CacheEntry<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    entry['v'] === 1 &&
    typeof entry['storedAt'] === 'number' &&
    typeof entry['ttlMs'] === 'number' &&
    'value' in entry
  );
}

export class WeatherCache {
  private readonly namespace: string;
  private readonly storage: CacheStorage;
  private readonly now: () => number;
  private readonly memory = new Map<string, CacheEntry<unknown>>();

  constructor(options: CacheOptions = {}) {
    this.namespace = options.namespace ?? CACHE_NAMESPACE;
    this.storage = options.storage ?? browserStorage();
    this.now = options.now ?? Date.now;
  }

  /** Fully qualified key, exposed so callers can inspect or invalidate one entry. */
  key(name: string): string {
    return `${this.namespace}:${name}`;
  }

  read<T>(name: string): CacheHit<T> | null {
    const key = this.key(name);
    const memoryEntry = this.memory.get(key) as CacheEntry<T> | undefined;
    const entry = memoryEntry ?? this.readStorage<T>(key);
    if (!entry) return null;

    const ageMs = Math.max(0, this.now() - entry.storedAt);
    return { value: entry.value, ageMs, fresh: ageMs <= entry.ttlMs };
  }

  write<T>(name: string, value: T, ttlMs: number): void {
    const key = this.key(name);
    const entry: CacheEntry<T> = { v: 1, storedAt: this.now(), ttlMs, value };
    this.memory.set(key, entry);
    try {
      this.storage.setItem(key, JSON.stringify(entry));
    } catch {
      // A full or unavailable quota does not invalidate the in-memory copy.
    }
  }

  remove(name: string): void {
    const key = this.key(name);
    this.memory.delete(key);
    try {
      this.storage.removeItem(key);
    } catch {
      // Nothing to do.
    }
  }

  clear(): void {
    this.memory.clear();
  }

  private readStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const raw = this.storage.getItem(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isCacheEntry(parsed)) {
        this.storage.removeItem(key);
        return null;
      }
      return parsed as CacheEntry<T>;
    } catch {
      try {
        this.storage.removeItem(key);
      } catch {
        // The entry is unusable either way.
      }
      return null;
    }
  }
}

/** Shared cache for the whole application. */
export const weatherCache = new WeatherCache();
