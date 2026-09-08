import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCyclesService } from "./review-cycles.service";

describe("ReviewCyclesService", () => {
  function createService() {
    const prisma = {
      reviewCycle: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      employee: {
        findMany: jest.fn()
      },
      performanceReview: {
        createMany: jest.fn()
      }
    };
    const audit = {
      log: jest.fn()
    };

    return {
      service: new ReviewCyclesService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService
      ),
      prisma,
      audit
    };
  }

  const actor = {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    roles: ["ADMIN"],
    permissions: ["REVIEW_MANAGE"],
    employeeId: null,
    mustChangePassword: false
  };

  describe("findOne", () => {
    it("throws REVIEW_CYCLE_NOT_FOUND when the cycle does not exist", async () => {
      const { service, prisma } = createService();
      prisma.reviewCycle.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toMatchObject({
        errorCode: "REVIEW_CYCLE_NOT_FOUND"
      });
    });
  });

  describe("launch", () => {
    it("creates one PENDING_SELF review per active employee, skipping duplicates", async () => {
      const { service, prisma, audit } = createService();
      prisma.reviewCycle.findUnique.mockResolvedValue({ id: 5, name: "Q3 2026" });
      prisma.employee.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
      prisma.performanceReview.createMany.mockResolvedValue({ count: 2 });

      const result = await service.launch(5, actor);

      expect(prisma.performanceReview.createMany).toHaveBeenCalledWith({
        data: [
          { cycleId: 5, employeeId: 1 },
          { cycleId: 5, employeeId: 2 },
          { cycleId: 5, employeeId: 3 }
        ],
        skipDuplicates: true
      });
      expect(result).toEqual({ createdCount: 2 });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "LAUNCH_REVIEW_CYCLE" })
      );
    });
  });
});
