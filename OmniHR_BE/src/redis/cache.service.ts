import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "./redis.service";

/**
 * Cache-aside reads on top of the shared Redis connection.
 *
 * Every method swallows Redis failures and reports a miss instead. A cache
 * that is down must slow the app back to plain database reads, never fail a
 * request, so callers can use `wrap` without a fallback path of their own.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Reads `key` from Redis and only calls `loader` on a miss, storing what it
   * returns for `ttlSeconds`.
   *
   * `null` and `undefined` are never stored, so a cached value and a miss stay
   * distinguishable and a "not found" is re-checked against the database.
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttlSeconds);
    }
    return value;
  }

  /** Returns null for a miss, malformed JSON, or an unreachable Redis. */
  async get<T>(key: string): Promise<T | null> {
    const client = this.redis.getClient();
    if (!client || !this.redis.isReady()) {
      return null;
    }

    try {
      const raw = await client.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.debug(`Cache read failed for ${key}: ${asMessage(error)}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = this.redis.getClient();
    if (!client || !this.redis.isReady()) {
      return;
    }

    try {
      await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      this.logger.debug(`Cache write failed for ${key}: ${asMessage(error)}`);
    }
  }

  /**
   * Drops one or many keys. Called from write paths, so a failure here would
   * leave a stale entry behind - it is logged at warn rather than debug, and
   * the TTL on every key bounds how long that can last.
   */
  async del(keys: string | string[]): Promise<void> {
    const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
    if (list.length === 0) {
      return;
    }

    const client = this.redis.getClient();
    if (!client || !this.redis.isReady()) {
      return;
    }

    try {
      await client.del(...list);
    } catch (error) {
      this.logger.warn(
        `Cache invalidation failed for ${list.join(", ")}: ${asMessage(error)}`,
      );
    }
  }
}

function asMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
