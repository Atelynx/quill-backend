interface MemoryCacheEntry {
  value: string;
  expiresAt: number | null;
}

export function serializeCacheValue<T>(value: T): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function deserializeCacheValue<T>(
  value: string | null | undefined,
): T | undefined {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

export class BoundedMemoryCache {
  private readonly entries = new Map<string, MemoryCacheEntry>();

  constructor(private readonly maxEntries: number) {}

  set(key: string, value: string, ttl?: number): void {
    this.removeExpired();
    this.entries.delete(key);

    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }

    this.entries.set(key, {
      value,
      expiresAt: ttl && ttl > 0 ? Date.now() + ttl : null,
    });
  }

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  keys(): string[] {
    this.removeExpired();
    return Array.from(this.entries.keys());
  }

  ttl(key: string): number {
    const entry = this.entries.get(key);
    if (!entry) return -2;

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return -2;
    }

    return entry.expiresAt === null ? -1 : entry.expiresAt - Date.now();
  }

  private removeExpired(): void {
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry)) this.entries.delete(key);
    }
  }

  private isExpired(entry: MemoryCacheEntry): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }
}
