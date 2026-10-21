import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

/**
 * Shared Redis connection for state that must be the same across API
 * instances - today the throttler counters and the chatbot rate limiter.
 *
 * Redis stays optional: with REDIS_HOST unset, or the server unreachable,
 * `isReady()` reports false and callers fall back to their in-process
 * counters. Rate limiting then degrades to per-instance accounting instead of
 * taking the whole API down with the cache.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private ready = false;
  private loggedDown = false;

  constructor(config: ConfigService) {
    const host = config.get<string>("REDIS_HOST")?.trim();
    if (!host) {
      this.client = null;
      this.logger.log("REDIS_HOST is not set - rate limits stay in-process");
      return;
    }

    const password = config.get<string>("REDIS_PASSWORD")?.trim();
    this.client = new Redis({
      host,
      port: Number(config.get("REDIS_PORT") ?? 6379),
      password: password || undefined,
      lazyConnect: true,
      // Fail a command outright while the connection is down rather than
      // queueing it, so a Redis outage never stalls a request.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 500, 5_000),
    });

    this.client.on("ready", () => {
      this.ready = true;
      this.loggedDown = false;
      this.logger.log(`Connected to Redis at ${host}`);
    });
    // ioredis retries forever, so log the first failure of an outage only.
    this.client.on("error", (error: Error) => {
      this.ready = false;
      if (!this.loggedDown) {
        this.loggedDown = true;
        this.logger.warn(
          `Redis unavailable (${error.message}) - falling back to in-process rate limits`,
        );
      }
    });
    this.client.on("end", () => {
      this.ready = false;
    });

    void this.client.connect().catch(() => {
      // The "error" handler above already reported it; retryStrategy keeps
      // trying in the background so a late-starting Redis still gets picked up.
    });
  }

  /** True only when a command can actually be served right now. */
  isReady() {
    return this.ready && this.client !== null;
  }

  getClient() {
    return this.client;
  }

  async onModuleDestroy() {
    if (!this.client) {
      return;
    }
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
