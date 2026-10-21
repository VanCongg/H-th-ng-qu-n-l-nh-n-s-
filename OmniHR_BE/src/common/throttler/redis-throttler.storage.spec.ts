import { RedisService } from "../../redis/redis.service";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

describe("RedisThrottlerStorage", () => {
  function createStorage(client: { eval: jest.Mock } | null) {
    const redis = {
      isReady: () => client !== null,
      getClient: () => client,
    };
    return new RedisThrottlerStorage(redis as unknown as RedisService);
  }

  it("reports the shared Redis count and converts milliseconds to seconds", async () => {
    const evalMock = jest.fn().mockResolvedValue([3, 45_000, 0, 0]);
    const storage = createStorage({ eval: evalMock });

    await expect(
      storage.increment("tracker-key", 60_000, 100, 60_000, "default"),
    ).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 45,
      isBlocked: false,
      timeToBlockExpire: 0,
    });

    // Both the counter and its block flag are passed as keys so the script
    // stays cluster-safe.
    expect(evalMock.mock.calls[0][1]).toBe(2);
    expect(evalMock.mock.calls[0][2]).toBe("throttle:default:tracker-key");
    expect(evalMock.mock.calls[0][3]).toBe("throttle:default:tracker-key:blocked");
  });

  it("surfaces a block from Redis", async () => {
    const storage = createStorage({
      eval: jest.fn().mockResolvedValue([101, 30_000, 1, 12_500]),
    });

    await expect(
      storage.increment("tracker-key", 60_000, 100, 60_000, "default"),
    ).resolves.toMatchObject({ isBlocked: true, timeToBlockExpire: 13 });
  });

  it("counts in process when Redis is not configured", async () => {
    const storage = createStorage(null);

    await expect(
      storage.increment("tracker-key", 60_000, 100, 60_000, "default"),
    ).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
    await expect(
      storage.increment("tracker-key", 60_000, 100, 60_000, "default"),
    ).resolves.toMatchObject({ totalHits: 2 });

    storage.onApplicationShutdown();
  });

  it("keeps counting in process when a Redis command fails", async () => {
    const evalMock = jest.fn().mockRejectedValue(new Error("connection lost"));
    const storage = createStorage({ eval: evalMock });

    await expect(
      storage.increment("tracker-key", 60_000, 100, 60_000, "default"),
    ).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
    expect(evalMock).toHaveBeenCalledTimes(1);

    storage.onApplicationShutdown();
  });
});
