import { AuditService } from "../common/services/audit.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { createFakeCache } from "../redis/cache.service.fake";
import { RolesService } from "./roles.service";

describe("RolesService cache invalidation", () => {
  const actor: AuthUser = {
    id: 99,
    username: "admin",
    email: "admin@example.com",
    roles: ["ADMIN"],
    permissions: [],
    employeeId: null,
    mustChangePassword: false,
  };

  const role = { id: 5, name: "MANAGER", isSystem: false, rolePermissions: [] };

  function createService() {
    const prisma = {
      role: {
        findUnique: jest.fn().mockResolvedValue(role),
        delete: jest.fn().mockResolvedValue(role),
      },
      permission: {
        findUnique: jest.fn().mockResolvedValue({ id: 7, code: "LEAVE_READ_TEAM" }),
      },
      rolePermission: {
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ roleId: 5 }),
      },
      // Three people hold this role.
      userRole: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId: 1 }, { userId: 2 }, { userId: 3 }]),
      },
    };
    const { cache, store } = createFakeCache();
    // Pretend all three are cached from earlier requests.
    store.set("auth:user:1", { id: 1 });
    store.set("auth:user:2", { id: 2 });
    store.set("auth:user:3", { id: 3 });
    store.set("auth:user:4", { id: 4 });

    return {
      service: new RolesService(
        prisma as unknown as PrismaService,
        { log: jest.fn() } as unknown as AuditService,
        cache,
      ),
      prisma,
      cacheStore: store,
    };
  }

  it("evicts every holder of the role when a permission is granted", async () => {
    const { service, cacheStore } = createService();

    await service.assignPermission(5, { permissionId: 7 }, actor);

    expect(cacheStore.has("auth:user:1")).toBe(false);
    expect(cacheStore.has("auth:user:2")).toBe(false);
    expect(cacheStore.has("auth:user:3")).toBe(false);
    // Someone without the role keeps their cached entry.
    expect(cacheStore.has("auth:user:4")).toBe(true);
  });

  it("evicts every holder when a permission is revoked", async () => {
    const { service, cacheStore } = createService();

    await service.removePermission(5, 7, actor);

    expect(cacheStore.has("auth:user:1")).toBe(false);
    expect(cacheStore.has("auth:user:3")).toBe(false);
  });

  it("reads the holders before deleting the role cascades them away", async () => {
    const { service, prisma, cacheStore } = createService();

    await service.remove(5, actor);

    const holderLookupOrder =
      prisma.userRole.findMany.mock.invocationCallOrder[0];
    const deleteOrder = prisma.role.delete.mock.invocationCallOrder[0];
    expect(holderLookupOrder).toBeLessThan(deleteOrder);
    expect(cacheStore.has("auth:user:2")).toBe(false);
  });
});
