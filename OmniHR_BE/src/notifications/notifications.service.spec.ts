import { PrismaService } from "../prisma/prisma.service";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  function createService() {
    const prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries))
    };
    const gateway = {
      emitToUser: jest.fn()
    };

    return {
      service: new NotificationsService(
        prisma as unknown as PrismaService,
        gateway as unknown as NotificationsGateway
      ),
      prisma,
      gateway
    };
  }

  const actor = {
    id: 7,
    username: "employee01",
    email: "employee01@example.com",
    roles: ["EMPLOYEE"],
    permissions: [],
    employeeId: 2,
    mustChangePassword: false
  };

  describe("create", () => {
    it("persists the notification then pushes it to the user's socket room", async () => {
      const { service, prisma, gateway } = createService();
      prisma.notification.create.mockResolvedValue({ id: 1, userId: 7 });

      const result = await service.create(7, "TASK_ASSIGNED", "New task", "You were assigned");

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 7, type: "TASK_ASSIGNED" })
        })
      );
      expect(gateway.emitToUser).toHaveBeenCalledWith(7, result);
    });
  });

  describe("markRead", () => {
    it("throws NOTIFICATION_NOT_FOUND when the notification belongs to a different user", async () => {
      const { service, prisma } = createService();
      prisma.notification.findUnique.mockResolvedValue({ id: 1, userId: 99 });

      await expect(service.markRead(1, actor)).rejects.toMatchObject({
        errorCode: "NOTIFICATION_NOT_FOUND"
      });
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it("marks the notification read when it belongs to the caller", async () => {
      const { service, prisma } = createService();
      prisma.notification.findUnique.mockResolvedValue({ id: 1, userId: 7 });
      prisma.notification.update.mockResolvedValue({ id: 1, isRead: true });

      await service.markRead(1, actor);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isRead: true }
      });
    });
  });

  describe("findSelf", () => {
    it("scopes the query to the caller's own userId", async () => {
      const { service, prisma } = createService();
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.findSelf(actor, { page: 1, limit: 20 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 7 }) })
      );
    });
  });
});
