import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { createFakeCache } from "../redis/cache.service.fake";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  function createService() {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn()
      }
    };
    const jwt = {
      verifyAsync: jest.fn(),
      signAsync: jest.fn()
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: "access_secret_for_tests",
          JWT_REFRESH_SECRET: "refresh_secret_for_tests",
          JWT_ACCESS_EXPIRES_IN: "15m",
          JWT_REFRESH_EXPIRES_IN: "7d",
          BCRYPT_SALT_ROUNDS: "1"
        };
        return values[key];
      })
    };
    const audit = {
      log: jest.fn()
    };

    const { cache, store } = createFakeCache();

    return {
      service: new AuthService(
        prisma as unknown as PrismaService,
        jwt as unknown as JwtService,
        config as unknown as ConfigService,
        audit as unknown as AuditService,
        cache
      ),
      prisma,
      jwt,
      cacheStore: store
    };
  }

  it("returns a full login-shaped session when refreshing tokens", async () => {
    const { service, prisma, jwt } = createService();
    const refreshToken = "refresh-token-long-enough-for-validation";
    const refreshTokenHash = await bcrypt.hash(refreshToken, 1);

    jwt.verifyAsync.mockResolvedValue({ sub: 1, version: 2 });
    jwt.signAsync
      .mockResolvedValueOnce("new-access-token")
      .mockResolvedValueOnce("new-refresh-token");
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 1,
        username: "manager",
        email: "manager@example.com",
        refreshTokenHash,
        refreshTokenVersion: 2,
        isActive: true,
        deletedAt: null
      })
      .mockResolvedValueOnce({
        id: 1,
        username: "manager",
        email: "manager@example.com",
        mustChangePassword: false,
        isActive: true,
        deletedAt: null,
        employee: { id: 10 },
        userRoles: [
          {
            role: {
              name: "MANAGER",
              rolePermissions: [
                { permission: { code: "EMPLOYEE_READ_TEAM" } },
                { permission: { code: "LEAVE_READ_TEAM" } }
              ]
            }
          }
        ]
      });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ refreshTokenVersion: 2 });
    prisma.user.update.mockResolvedValue({});

    await expect(service.refresh({ refreshToken })).resolves.toMatchObject({
      user: {
        id: 1,
        username: "manager",
        email: "manager@example.com",
        roles: ["MANAGER"],
        permissions: ["EMPLOYEE_READ_TEAM", "LEAVE_READ_TEAM"],
        employeeId: 10,
        mustChangePassword: false
      },
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      tokenType: "Bearer"
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        refreshTokenHash: expect.any(String),
        refreshTokenVersion: 3
      }
    });
  });

  describe("hydrateAuthUser caching", () => {
    const dbUser = {
      id: 1,
      username: "manager",
      email: "manager@example.com",
      isActive: true,
      deletedAt: null,
      mustChangePassword: false,
      employee: { id: 10, deletedAt: null },
      userRoles: [
        {
          role: {
            name: "MANAGER",
            rolePermissions: [{ permission: { code: "LEAVE_READ_TEAM" } }]
          }
        }
      ]
    };

    it("reads from the cache on the second call instead of rejoining four tables", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue(dbUser);

      const first = await service.hydrateAuthUser(1);
      const second = await service.hydrateAuthUser(1);

      expect(second).toEqual(first);
      expect(second).toEqual(
        expect.objectContaining({
          id: 1,
          roles: ["MANAGER"],
          permissions: ["LEAVE_READ_TEAM"]
        })
      );
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it("re-reads an inactive user every time rather than caching the rejection", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue({ ...dbUser, isActive: false });

      await expect(service.hydrateAuthUser(1)).resolves.toBeNull();
      await expect(service.hydrateAuthUser(1)).resolves.toBeNull();

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it("drops the cached user when the password changes", async () => {
      const { service, prisma, cacheStore } = createService();
      prisma.user.findUnique.mockResolvedValue(dbUser);
      await service.hydrateAuthUser(1);
      expect(cacheStore.has("auth:user:1")).toBe(true);

      // changePassword re-reads the row to verify the current password.
      prisma.user.findUnique.mockResolvedValue({
        ...dbUser,
        passwordHash: await bcrypt.hash("old-password", 1)
      });
      prisma.user.update.mockResolvedValue({});

      await service.changePassword(
        {
          id: 1,
          username: "manager",
          email: "manager@example.com",
          roles: ["MANAGER"],
          permissions: [],
          employeeId: 10,
          mustChangePassword: true
        },
        { currentPassword: "old-password", newPassword: "New@password1" }
      );

      expect(cacheStore.has("auth:user:1")).toBe(false);
    });
  });
});
