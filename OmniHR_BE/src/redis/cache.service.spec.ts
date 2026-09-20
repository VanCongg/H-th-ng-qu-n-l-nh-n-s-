import { CacheService } from "./cache.service";
import { RedisService } from "./redis.service";

describe("CacheService", () => {
  function createCache(client: Record<string, jest.Mock> | null) {
    const redis = {
      isReady: () => client !== null,
      getClient: () => client,
    };
    return new CacheService(redis as unknown as RedisService);
  }

  function fakeClient(overrides: Record<string, jest.Mock> = {}) {
    return {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1),
      ...overrides,
    };
  }

  it("runs the loader on a miss and stores the result with a TTL", async () => {
    const client = fakeClient();
    const loader = jest.fn().mockResolvedValue({ id: 1, roles: ["ADMIN"] });

    await expect(createCache(client).wrap("k", 60, loader)).resolves.toEqual({
      id: 1,
      roles: ["ADMIN"],
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith(
      "k",
      JSON.stringify({ id: 1, roles: ["ADMIN"] }),
      "EX",
      60,
    );
  });

  it("serves a hit from Redis without touching the loader", async () => {
    const client = fakeClient({
      get: jest.fn().mockResolvedValue(JSON.stringify({ id: 1 })),
    });
    const loader = jest.fn();

    await expect(createCache(client).wrap("k", 60, loader)).resolves.toEqual({
      id: 1,
    });

    expect(loader).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
  });

  it("never stores null, so a miss stays re-checkable against the database", async () => {
    const client = fakeClient();
    const cache = createCache(client);
    const loader = jest.fn().mockResolvedValue(null);

    await expect(cache.wrap("k", 60, loader)).resolves.toBeNull();
    await expect(cache.wrap("k", 60, loader)).resolves.toBeNull();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(client.set).not.toHaveBeenCalled();
  });

  it("falls through to the loader when Redis is not configured", async () => {
    const loader = jest.fn().mockResolvedValue("value");

    await expect(createCache(null).wrap("k", 60, loader)).resolves.toBe("value");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("treats a failing read as a miss instead of failing the request", async () => {
    const client = fakeClient({
      get: jest.fn().mockRejectedValue(new Error("connection lost")),
    });
    const loader = jest.fn().mockResolvedValue("value");

    await expect(createCache(client).wrap("k", 60, loader)).resolves.toBe("value");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("treats malformed cached JSON as a miss", async () => {
    const client = fakeClient({ get: jest.fn().mockResolvedValue("{not json") });
    const loader = jest.fn().mockResolvedValue("value");

    await expect(createCache(client).wrap("k", 60, loader)).resolves.toBe("value");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("swallows a failing write rather than failing the request", async () => {
    const client = fakeClient({
      set: jest.fn().mockRejectedValue(new Error("read only replica")),
    });

    await expect(
      createCache(client).wrap("k", 60, async () => "value"),
    ).resolves.toBe("value");
  });

  it("deletes many keys in one call and ignores an empty list", async () => {
    const client = fakeClient();
    const cache = createCache(client);

    await cache.del(["a", "b"]);
    expect(client.del).toHaveBeenCalledWith("a", "b");

    client.del.mockClear();
    await cache.del([]);
    expect(client.del).not.toHaveBeenCalled();
  });

  it("swallows a failing invalidation", async () => {
    const client = fakeClient({
      del: jest.fn().mockRejectedValue(new Error("connection lost")),
    });

    await expect(createCache(client).del("k")).resolves.toBeUndefined();
  });
});
