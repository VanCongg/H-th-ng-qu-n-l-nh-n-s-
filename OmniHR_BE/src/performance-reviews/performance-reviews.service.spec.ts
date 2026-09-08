import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { PerformanceReviewsService } from "./performance-reviews.service";

describe("PerformanceReviewsService", () => {
  function createService() {
    const prisma = {
      performanceReview: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries))
    };
    const audit = {
      log: jest.fn()
    };
    const accessControl = {
      ensureCanReadEmployee: jest.fn(),
      ensureCanReviewEmployee: jest.fn(),
      teamEmployeeIds: jest.fn()
    };
    const notifications = {
      create: jest.fn()
    };

    return {
      service: new PerformanceReviewsService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        accessControl as unknown as AccessControlService,
        notifications as unknown as NotificationsService
      ),
      prisma,
      audit,
      accessControl,
      notifications
    };
  }

  const employeeActor = {
    id: 7,
    username: "employee01",
    email: "employee01@example.com",
    roles: ["EMPLOYEE"],
    permissions: ["REVIEW_SUBMIT_SELF"],
    employeeId: 2,
    mustChangePassword: false
  };

  const managerActor = {
    id: 3,
    username: "manager01",
    email: "manager01@example.com",
    roles: ["MANAGER"],
    permissions: ["REVIEW_SUBMIT_MANAGER"],
    employeeId: 1,
    mustChangePassword: false
  };

  const adminActor = {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    roles: ["ADMIN"],
    permissions: ["REVIEW_MANAGE"],
    employeeId: null,
    mustChangePassword: false
  };

  describe("submitSelf", () => {
    it("rejects submitting someone else's self-assessment", async () => {
      const { service, prisma } = createService();
      prisma.performanceReview.findUnique.mockResolvedValue({
        id: 1,
        employeeId: 99,
        status: "PENDING_SELF"
      });

      await expect(
        service.submitSelf(1, { selfRating: 4 }, employeeActor)
      ).rejects.toMatchObject({ errorCode: "REVIEW_ACCESS_DENIED" });
      expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    });

    it("rejects submitting when not in PENDING_SELF status", async () => {
      const { service, prisma } = createService();
      prisma.performanceReview.findUnique.mockResolvedValue({
        id: 1,
        employeeId: 2,
        status: "SELF_SUBMITTED"
      });

      await expect(
        service.submitSelf(1, { selfRating: 4 }, employeeActor)
      ).rejects.toMatchObject({ errorCode: "REVIEW_INVALID_STATUS" });
    });

    it("submits the self-assessment and transitions to SELF_SUBMITTED", async () => {
      const { service, prisma } = createService();
      prisma.performanceReview.findUnique.mockResolvedValue({
        id: 1,
        employeeId: 2,
        status: "PENDING_SELF"
      });
      prisma.performanceReview.update.mockResolvedValue({
        id: 1,
        status: "SELF_SUBMITTED"
      });

      await service.submitSelf(1, { selfRating: 4, selfComment: "Good quarter" }, employeeActor);

      expect(prisma.performanceReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            selfRating: 4,
            selfComment: "Good quarter",
            status: "SELF_SUBMITTED"
          })
        })
      );
    });
  });

  describe("submitManagerReview", () => {
    it("checks manager scope before allowing a manager review", async () => {
      const { service, prisma, accessControl } = createService();
      prisma.performanceReview.findUnique.mockResolvedValue({
        id: 1,
        employeeId: 2,
        status: "SELF_SUBMITTED"
      });
      accessControl.ensureCanReviewEmployee.mockRejectedValue(
        Object.assign(new Error("denied"), { errorCode: "MANAGER_SCOPE_DENIED" })
      );

      await expect(
        service.submitManagerReview(1, { managerRating: 4 }, managerActor)
      ).rejects.toMatchObject({ errorCode: "MANAGER_SCOPE_DENIED" });
      expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    });
  });

  describe("finalize", () => {
    it("rejects finalizing before MANAGER_REVIEWED", async () => {
      const { service, prisma } = createService();
      prisma.performanceReview.findUnique.mockResolvedValue({
        id: 1,
        employeeId: 2,
        status: "SELF_SUBMITTED"
      });

      await expect(service.finalize(1, {}, adminActor)).rejects.toMatchObject({
        errorCode: "REVIEW_INVALID_STATUS"
      });
    });

    it("defaults finalRating to managerRating and notifies the employee", async () => {
      const { service, prisma, notifications } = createService();
      prisma.performanceReview.findUnique.mockResolvedValue({
        id: 1,
        employeeId: 2,
        status: "MANAGER_REVIEWED",
        managerRating: 4
      });
      prisma.performanceReview.update.mockResolvedValue({
        id: 1,
        status: "FINALIZED",
        finalRating: 4,
        employee: { userId: 5 },
        cycle: { name: "Q3 2026" }
      });

      await service.finalize(1, {}, adminActor);

      expect(prisma.performanceReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ finalRating: 4, status: "FINALIZED" })
        })
      );
      expect(notifications.create).toHaveBeenCalledWith(
        5,
        "REVIEW_FINALIZED",
        expect.any(String),
        expect.any(String),
        "PerformanceReview",
        1
      );
    });

    it("does not notify when the employee has no linked user account", async () => {
      const { service, prisma, notifications } = createService();
      prisma.performanceReview.findUnique.mockResolvedValue({
        id: 1,
        employeeId: 2,
        status: "MANAGER_REVIEWED",
        managerRating: 3
      });
      prisma.performanceReview.update.mockResolvedValue({
        id: 1,
        status: "FINALIZED",
        finalRating: 3,
        employee: { userId: null },
        cycle: { name: "Q3 2026" }
      });

      await service.finalize(1, {}, adminActor);

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe("findSelf", () => {
    it("scopes the query to the caller's own employeeId", async () => {
      const { service, prisma } = createService();
      prisma.performanceReview.findMany.mockResolvedValue([]);
      prisma.performanceReview.count.mockResolvedValue(0);

      await service.findSelf(employeeActor, { page: 1, limit: 20 });

      expect(prisma.performanceReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ employeeId: 2 }) })
      );
    });
  });
});
