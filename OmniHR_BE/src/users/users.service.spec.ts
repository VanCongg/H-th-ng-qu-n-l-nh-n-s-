import { ConfigService } from "@nestjs/config";
import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { createFakeCache } from "../redis/cache.service.fake";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  function createService() {
    const prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn()
      },
      employee: {
        findFirst: jest.fn()
      },
      role: {
        findMany: jest.fn().mockResolvedValue([])
      },
      $transaction: jest.fn()
    };
    const config = { get: jest.fn() };
    const audit = { log: jest.fn() };

    return {
      service: new UsersService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService,
        audit as unknown as AuditService,
        createFakeCache().cache
      ),
      prisma
    };
  }

  const actor = {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    roles: ["ADMIN"],
    permissions: ["USER_CREATE", "USER_UPDATE"],
    employeeId: null,
    mustChangePassword: false
  };

  function createDto(overrides: Record<string, unknown> = {}) {
    return {
      username: "vancong",
      email: "VanCongNg1908@gmail.com",
      password: "Password@123",
      roleIds: [2],
      ...overrides
    } as never;
  }

  describe("create", () => {
    it("rejects a duplicate email before hitting the database constraint", async () => {
      const { service, prisma } = createService();
      prisma.user.findMany.mockResolvedValue([
        {
          username: "someone-else",
          email: "vancongng1908@gmail.com",
          deletedAt: null
        }
      ]);

      await expect(service.create(createDto(), actor as never)).rejects.toMatchObject({
        message: "Email already exists",
        errorCode: "VALIDATION_ERROR"
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("says so when the email belongs to a deleted account", async () => {
      const { service, prisma } = createService();
      prisma.user.findMany.mockResolvedValue([
        {
          username: "someone-else",
          email: "vancongng1908@gmail.com",
          deletedAt: new Date("2026-09-01T00:00:00.000Z")
        }
      ]);

      await expect(service.create(createDto(), actor as never)).rejects.toMatchObject({
        message: "Email belongs to a deleted account"
      });
    });

    it("reports the username conflict first when both collide", async () => {
      const { service, prisma } = createService();
      prisma.user.findMany.mockResolvedValue([
        { username: "vancong", email: "other@omnihr.vn", deletedAt: null },
        {
          username: "another",
          email: "vancongng1908@gmail.com",
          deletedAt: null
        }
      ]);

      await expect(service.create(createDto(), actor as never)).rejects.toMatchObject({
        message: "Username already exists"
      });
    });

    it("looks the email up in lowercase", async () => {
      const { service, prisma } = createService();

      await expect(service.create(createDto(), actor as never)).rejects.toBeDefined();
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ username: "vancong" }, { email: "vancongng1908@gmail.com" }],
          id: undefined
        },
        select: { username: true, email: true, deletedAt: true }
      });
    });
  });

  describe("update", () => {
    it("ignores the account being updated when checking for conflicts", async () => {
      const { service, prisma } = createService();
      prisma.user.findFirst.mockResolvedValue({
        id: 7,
        username: "vancong",
        email: "vancongng1908@gmail.com",
        employee: null,
        userRoles: []
      });

      await expect(
        service.update(7, { email: "New@omnihr.vn" } as never, actor as never)
      ).rejects.toBeDefined();
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ email: "new@omnihr.vn" }],
          id: { not: 7 }
        },
        select: { username: true, email: true, deletedAt: true }
      });
    });

    it("rejects an email already taken by another account", async () => {
      const { service, prisma } = createService();
      prisma.user.findFirst.mockResolvedValue({
        id: 7,
        username: "vancong",
        email: "old@omnihr.vn",
        employee: null,
        userRoles: []
      });
      prisma.user.findMany.mockResolvedValue([
        { username: "someone-else", email: "taken@omnihr.vn", deletedAt: null }
      ]);

      await expect(
        service.update(7, { email: "taken@omnihr.vn" } as never, actor as never)
      ).rejects.toMatchObject({ message: "Email already exists" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
