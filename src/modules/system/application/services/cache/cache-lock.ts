import Redis from 'ioredis';
import { BoundedMemoryCache } from './bounded-memory-cache';
import { CacheFallbackPolicy } from './cache-fallback-policy';

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export async function acquireCacheLock(
  redis: Redis | null,
  fallbackStore: BoundedMemoryCache,
  fallbackPolicy: CacheFallbackPolicy,
  key: string,
  owner: string,
  ttl: number,
): Promise<boolean> {
  if (redis) {
    return (await redis.set(key, owner, 'PX', ttl, 'NX')) === 'OK';
  }
  fallbackPolicy.assertAllowed();
  if (fallbackStore.get(key) !== undefined) return false;
  fallbackStore.set(key, owner, ttl);
  return true;
}

export async function releaseCacheLock(
  redis: Redis | null,
  fallbackStore: BoundedMemoryCache,
  fallbackPolicy: CacheFallbackPolicy,
  key: string,
  owner: string,
): Promise<boolean> {
  if (redis) {
    return (await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, owner)) === 1;
  }
  fallbackPolicy.assertAllowed();
  if (fallbackStore.get(key) !== owner) return false;
  fallbackStore.delete(key);
  return true;
}
