import { PrismaService } from "../../prisma/prisma.service";
import { createFakeCache } from "../../redis/cache.service.fake";
import { SystemSettingsService } from "./system-settings.service";

describe("SystemSettingsService", () => {
  function createService() {
    const prisma = {
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue({
          key: "default",
          value: { companyName: "OmniHR", attendanceRadiusMeters: 250 }
        }),
        upsert: jest.fn().mockResolvedValue({})
      }
    };
    const { cache, store } = createFakeCache();

    return {
      service: new SystemSettingsService(
        prisma as unknown as PrismaService,
        cache
      ),
      prisma,
      cacheStore: store
    };
  }

  it("reads the settings row once and serves the rest from the cache", async () => {
    const { service, prisma } = createService();

    const first = await service.getSettings();
    const second = await service.getSettings();

    expect(second).toEqual(first);
    expect(second.attendanceRadiusMeters).toBe(250);
    // Attendance, leave, payroll and the chatbot all call this per request.
    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);
  });

  it("invalidates the cached row when settings are saved", async () => {
    const { service, prisma, cacheStore } = createService();
    await service.getSettings();
    expect(cacheStore.has("system:settings")).toBe(true);

    await service.updateSettings({ attendanceRadiusMeters: 500 });

    expect(cacheStore.has("system:settings")).toBe(false);
    expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it("serves the saved value on the next read, not the stale one", async () => {
    const { service, prisma } = createService();
    await service.getSettings();

    await service.updateSettings({ attendanceRadiusMeters: 500 });
    prisma.systemSetting.findUnique.mockResolvedValue({
      key: "default",
      value: { companyName: "OmniHR", attendanceRadiusMeters: 500 }
    });

    await expect(service.getSettings()).resolves.toMatchObject({
      attendanceRadiusMeters: 500
    });
  });
});
