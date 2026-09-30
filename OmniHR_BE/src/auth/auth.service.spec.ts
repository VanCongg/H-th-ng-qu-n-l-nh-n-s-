import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { createFakeCache } from "../redis/cache.service.fake";
import { NotificationsService } from "../notifications/notifications.service";
import { VerificationService } from "../verification/verification.service";
import { AuthService, passwordContainsIdentity } from "./auth.service";

describe("AuthService", () => {
  function createService() {
    const prisma = {
      user: {
        findFirst: jest.fn(),
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
    const notifications = { create: jest.fn() };
    const verification = { consume: jest.fn(), requestCode: jest.fn() };

    return {
      service: new AuthService(
        prisma as unknown as PrismaService,
        jwt as unknown as JwtService,
        config as unknown as ConfigService,
        audit as unknown as AuditService,
        cache,
        notifications as unknown as NotificationsService,
        verification as unknown as VerificationService
      ),
      prisma,
      jwt,
      audit,
      notifications,
      verification,
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

    it("replaces the cached user when the password changes, so the prompt to change it goes away", async () => {
      const { service, prisma, jwt, cacheStore } = createService();
      prisma.user.findUnique.mockResolvedValue({ ...dbUser, mustChangePassword: true });
      await service.hydrateAuthUser(1);
      expect((cacheStore.get("auth:user:1") as { mustChangePassword: boolean }).mustChangePassword).toBe(true);

      // changePassword re-reads the row to verify the current password, then
      // reads it again - now changed - to hand this device fresh tokens.
      prisma.user.findUnique
        .mockResolvedValueOnce({ ...dbUser, passwordHash: await bcrypt.hash("Old@password1", 1) })
        .mockResolvedValue({ ...dbUser, mustChangePassword: false });
      prisma.user.update.mockResolvedValue({});
      prisma.user.findUniqueOrThrow.mockResolvedValue({ refreshTokenVersion: 1 });
      jwt.signAsync.mockResolvedValue("token");

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
        { currentPassword: "Old@password1", newPassword: "Brand#new2026" }
      );

      expect((cacheStore.get("auth:user:1") as { mustChangePassword: boolean }).mustChangePassword).toBe(false);
    });

    it("treats a terminated employee's account as signed out", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue({
        ...dbUser,
        employee: { id: 10, deletedAt: null, status: "TERMINATED" }
      });

      await expect(service.hydrateAuthUser(1)).resolves.toBeNull();
    });
  });

  describe("changing a password", () => {
    const actor = {
      id: 1,
      username: "manager",
      email: "manager@example.com",
      roles: ["MANAGER"],
      permissions: [],
      employeeId: 10,
      mustChangePassword: false
    };

    async function setUp(current = "Old@password1") {
      const created = createService();
      const dbUser = {
        id: 1,
        username: "manager",
        email: "manager@example.com",
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        passwordHash: await bcrypt.hash(current, 1),
        employee: { id: 10, deletedAt: null, status: "ACTIVE" },
        userRoles: []
      };
      created.prisma.user.findUnique.mockResolvedValue(dbUser);
      created.prisma.user.update.mockResolvedValue({});
      created.prisma.user.findUniqueOrThrow.mockResolvedValue({ refreshTokenVersion: 4 });
      created.jwt.signAsync.mockResolvedValueOnce("new-access").mockResolvedValueOnce("new-refresh");
      return created;
    }

    it("keeps this device signed in with fresh tokens, and says so in the audit log and to the owner", async () => {
      const { service, audit, notifications } = await setUp();

      const result = await service.changePassword(actor, {
        currentPassword: "Old@password1",
        newPassword: "Brand#new2026"
      });

      expect(result).toMatchObject({ accessToken: "new-access", refreshToken: "new-refresh" });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "CHANGE_PASSWORD" }));
      expect(notifications.create).toHaveBeenCalledWith(
        1,
        "PASSWORD_CHANGED",
        expect.any(String),
        expect.any(String),
        "User",
        1
      );
    });

    it("will not change it without the code emailed for it", async () => {
      const { service, verification, prisma } = await setUp();
      verification.consume.mockRejectedValue(Object.assign(new Error("code"), { errorCode: "VERIFICATION_CODE_REQUIRED" }));

      await expect(
        service.changePassword(actor, { currentPassword: "Old@password1", newPassword: "Brand#new2026" })
      ).rejects.toMatchObject({ errorCode: "VERIFICATION_CODE_REQUIRED" });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("checks the code for a password change, last", async () => {
      const { service, verification } = await setUp();

      await service.changePassword(actor, {
        currentPassword: "Old@password1",
        newPassword: "Brand#new2026",
        otpCode: "123456"
      });

      expect(verification.consume).toHaveBeenCalledWith(1, "PASSWORD_CHANGE", "123456");
    });

    it("refuses the same password again", async () => {
      const { service } = await setUp();

      await expect(
        service.changePassword(actor, { currentPassword: "Old@password1", newPassword: "Old@password1" })
      ).rejects.toMatchObject({ errorCode: "PASSWORD_REUSED" });
    });

    it("refuses a password built on the username", async () => {
      const { service } = await setUp();

      await expect(
        service.changePassword(actor, { currentPassword: "Old@password1", newPassword: "Manager@2026" })
      ).rejects.toMatchObject({ errorCode: "PASSWORD_CONTAINS_IDENTITY" });
    });

    it("locks the form after five wrong current passwords", async () => {
      const { service, prisma } = await setUp();
      const wrong = { currentPassword: "Guess@0000", newPassword: "Brand#new2026" };

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(service.changePassword(actor, wrong)).rejects.toMatchObject({
          errorCode: "CURRENT_PASSWORD_INVALID"
        });
      }
      await expect(
        service.changePassword(actor, { currentPassword: "Old@password1", newPassword: "Brand#new2026" })
      ).rejects.toMatchObject({ errorCode: "PASSWORD_CHANGE_LOCKED" });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("forgotten password", () => {
    async function account(overrides: Record<string, unknown> = {}) {
      return {
        id: 7,
        username: "congnv",
        email: "nvcong1908@gmail.com",
        isActive: true,
        deletedAt: null,
        passwordHash: await bcrypt.hash("Old@password1", 1),
        employee: { status: "ACTIVE" },
        ...overrides
      };
    }

    it("emails a reset code to the account's own address", async () => {
      const { service, prisma, verification } = createService();
      prisma.user.findFirst.mockResolvedValueOnce(await account());

      const result = await service.forgotPassword({ identifier: "congnv" });

      expect(verification.requestCode).toHaveBeenCalledWith({ id: 7 }, "PASSWORD_RESET", null, undefined);
      expect(result.message).toContain("If the account exists");
    });

    it("answers the same for a name with no account, sending nothing", async () => {
      const { service, prisma, verification } = createService();
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.forgotPassword({ identifier: "nobody" });

      expect(verification.requestCode).not.toHaveBeenCalled();
      expect(result.message).toContain("If the account exists");
    });

    it("sends nothing for a disabled account", async () => {
      const { service, prisma, verification } = createService();
      prisma.user.findFirst.mockResolvedValueOnce(await account({ isActive: false }));

      await service.forgotPassword({ identifier: "congnv" });

      expect(verification.requestCode).not.toHaveBeenCalled();
    });

    it("sets the new password with the code and signs every session out", async () => {
      const { service, prisma, verification, audit } = createService();
      prisma.user.findFirst.mockResolvedValueOnce(await account());
      prisma.user.update.mockResolvedValue({});

      await service.resetPassword({ identifier: "congnv", otpCode: "123456", newPassword: "Brand#new2026" });

      expect(verification.consume).toHaveBeenCalledWith(7, "PASSWORD_RESET", "123456");
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
        refreshTokenHash: null,
        refreshTokenVersion: { increment: 1 },
        mustChangePassword: false
      });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "RESET_PASSWORD_BY_EMAIL" }));
    });

    it("gives an unknown name the same answer as a wrong code", async () => {
      const { service, prisma } = createService();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword({ identifier: "nobody", otpCode: "123456", newPassword: "Brand#new2026" })
      ).rejects.toMatchObject({ errorCode: "VERIFICATION_CODE_INVALID" });
    });
  });

  describe("passwordContainsIdentity", () => {
    it("spots the username or the email name, ignoring case", () => {
      expect(passwordContainsIdentity("xXcongnv99!", "congnv", "cong.nv@omnihr.com")).toBe(true);
      expect(passwordContainsIdentity("Hello#CONG.NV1", "someone", "cong.nv@omnihr.com")).toBe(true);
    });

    it("ignores names too short to matter", () => {
      expect(passwordContainsIdentity("Banana#2026", "an", "an@omnihr.com")).toBe(false);
    });
  });

  describe("login by employee code", () => {
    async function account(id: number) {
      return {
        id,
        username: `user${id}`,
        email: `user${id}@example.com`,
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        passwordHash: await bcrypt.hash("secret1", 1),
        employee: { id: 10 + id, deletedAt: null, status: "ACTIVE" },
        userRoles: []
      };
    }

    function stubSession(prisma: ReturnType<typeof createService>["prisma"], jwt: ReturnType<typeof createService>["jwt"], user: unknown) {
      prisma.user.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.findUniqueOrThrow.mockResolvedValue({ refreshTokenVersion: 1 });
      jwt.signAsync.mockResolvedValue("token");
    }

    it("finds the account by the employee code when no username or email matches", async () => {
      const { service, prisma, jwt } = createService();
      const user = await account(7);
      prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(user);
      stubSession(prisma, jwt, user);

      const session = await service.login({ usernameOrEmail: " it011 ", password: "secret1" });

      expect(session.user.id).toBe(7);
      expect(prisma.user.findFirst.mock.calls[1][0].where).toEqual({
        employee: { is: { employeeCode: { equals: "it011", mode: "insensitive" }, deletedAt: null } }
      });
    });

    it("prefers the username over someone else's employee code", async () => {
      const { service, prisma, jwt } = createService();
      const user = await account(3);
      prisma.user.findFirst.mockResolvedValueOnce(user);
      stubSession(prisma, jwt, user);

      await service.login({ usernameOrEmail: "user3", password: "secret1" });

      expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe("terminated employees", () => {
    it("refuses the login even though the user account is still active", async () => {
      const { service, prisma } = createService();
      prisma.user.findFirst.mockResolvedValue({
        id: 1,
        isActive: true,
        deletedAt: null,
        passwordHash: await bcrypt.hash("secret", 1),
        employee: { status: "TERMINATED" }
      });

      await expect(
        service.login({ usernameOrEmail: "left@example.com", password: "secret" })
      ).rejects.toMatchObject({ errorCode: "USER_INACTIVE" });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("refuses to refresh a session opened before the termination", async () => {
      const { service, prisma, jwt } = createService();
      jwt.verifyAsync.mockResolvedValue({ sub: 1, version: 2 });
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
        deletedAt: null,
        refreshTokenVersion: 2,
        employee: { status: "TERMINATED" }
      });

      await expect(
        service.refresh({ refreshToken: "refresh-token-long-enough-for-validation" })
      ).rejects.toMatchObject({ errorCode: "INVALID_REFRESH_TOKEN" });
    });

    it("keeps an inactive (not terminated) employee signed in", async () => {
      const { service, prisma } = createService();
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: "onleave",
        email: "onleave@example.com",
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        employee: { id: 10, deletedAt: null, status: "INACTIVE" },
        userRoles: []
      });

      await expect(service.hydrateAuthUser(1)).resolves.toMatchObject({ employeeId: 10 });
    });
  });
});
