import { ConfigService } from "@nestjs/config";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "./audit-logs.service";

describe("AuditLogsService", () => {
  function createService(settings = { auditRetentionDays: 365, auditSecurityRetentionDays: 730 }) {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockReturnValue("rows"),
        count: jest.fn().mockReturnValue("total"),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 })
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    };
    const systemSettings = { getSettings: jest.fn().mockResolvedValue(settings) };
    const config = { get: jest.fn().mockReturnValue("false") };
    return {
      service: new AuditLogsService(
        prisma as unknown as PrismaService,
        systemSettings as unknown as SystemSettingsService,
        config as unknown as ConfigService
      ),
      prisma
    };
  }

  describe("findAll", () => {
    it("narrows to one group and hides everyday steps", async () => {
      const { service, prisma } = createService();

      await service.findAll({ category: "WORK", importantOnly: true } as never);

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.AND[0].action.in).toContain("UPDATE_TASK");
      expect(where.AND[1].action.notIn).toContain("UPDATE_TASK_STATUS");
    });

    it("counts the whole last day of a date range", async () => {
      const { service, prisma } = createService();

      await service.findAll({ fromDate: "2026-09-20", toDate: "2026-09-27" } as never);

      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt.lte.toISOString()).toBe("2026-09-27T23:59:59.999Z");
    });
  });

  describe("purgeExpired", () => {
    const now = new Date("2026-09-27T00:00:00.000Z");

    it("keeps security actions longer than everyday ones", async () => {
      const { service, prisma } = createService();

      const deleted = await service.purgeExpired(now);

      const [everyday, security] = prisma.auditLog.deleteMany.mock.calls.map(([args]) => args.where);
      expect(everyday.action.notIn).toContain("LOGIN");
      expect(everyday.createdAt.lt).toEqual(new Date("2025-09-27T00:00:00.000Z"));
      expect(security.action.in).toContain("ASSIGN_ROLE");
      expect(security.createdAt.lt).toEqual(new Date("2024-09-27T00:00:00.000Z"));
      expect(deleted).toBe(6);
    });

    it("keeps everything when retention is set to 0", async () => {
      const { service, prisma } = createService({ auditRetentionDays: 0, auditSecurityRetentionDays: 0 });

      await service.purgeExpired(now);

      expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    });
  });
});
