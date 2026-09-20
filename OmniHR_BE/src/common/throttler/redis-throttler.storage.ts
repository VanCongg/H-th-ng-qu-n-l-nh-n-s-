import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { ThrottlerStorage, ThrottlerStorageService } from "@nestjs/throttler";
import { RedisService } from "../../redis/redis.service";

// The package does not re-export the record type from its entry point, and a
// deep import into dist/ would break on any internal reshuffle.
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage["increment"]>
>;

/**
 * Counts requests in Redis so every API instance shares one budget. The
 * in-memory storage that ships with @nestjs/throttler counts per process, so
 * running N instances silently multiplies every limit by N.
 *
 * A Redis outage falls back to that in-memory storage: the limit gets looser,
 * never absent, and requests keep flowing.
 */
// One round trip per request, so the read-check-write has to be atomic.
// Counting is a fixed window: the first hit sets the expiry and the whole
// window resets together.
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local hitsTtl = redis.call('PTTL', hitsKey)
  if hitsTtl < 0 then hitsTtl = 0 end
  return { tonumber(redis.call('GET', hitsKey)) or (limit + 1), hitsTtl, 1, blockTtl }
end

local hits = redis.call('INCR', hitsKey)
local hitsTtl = redis.call('PTTL', hitsKey)
if hits == 1 or hitsTtl < 0 then
  redis.call('PEXPIRE', hitsKey, ttl)
  hitsTtl = ttl
end

if hits > limit then
  if blockDuration > 0 then
    redis.call('SET', blockKey, 1, 'PX', blockDuration)
    return { hits, hitsTtl, 1, blockDuration }
  end
  return { hits, hitsTtl, 1, hitsTtl }
end

return { hits, hitsTtl, 0, 0 }
`;

/** The guard reports these as seconds; Redis works in milliseconds. */
function toSeconds(milliseconds: number) {
  return Math.ceil(milliseconds / 1000);
}

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly fallback = new ThrottlerStorageService();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redis.getClient();
    if (!client || !this.redis.isReady()) {
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }

    const hitsKey = `throttle:${throttlerName}:${key}`;
    try {
      const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] =
        (await client.eval(
          INCREMENT_SCRIPT,
          2,
          hitsKey,
          `${hitsKey}:blocked`,
          ttl,
          limit,
          blockDuration,
        )) as [number, number, number, number];

      return {
        totalHits,
        timeToExpire: toSeconds(timeToExpire),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: toSeconds(timeToBlockExpire),
      };
    } catch {
      // Connection dropped mid-flight - the error is already logged by
      // RedisService, so just keep serving with the in-process counters.
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  onApplicationShutdown() {
    this.fallback.onApplicationShutdown();
  }
}
