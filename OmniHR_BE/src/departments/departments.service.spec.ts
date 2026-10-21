import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { DepartmentsService } from "./departments.service";

describe("DepartmentsService", () => {
  function createService() {
    const prisma = {
      department: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      employee: {
        findFirst: jest.fn()
      }
    };
    const audit = {
      log: jest.fn()
    };

    return {
      service: new DepartmentsService(
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
    permissions: ["DEPARTMENT_UPDATE"],
    employeeId: null,
    mustChangePassword: false
  };

  describe("findOne", () => {
    it("throws DEPARTMENT_NOT_FOUND when the department does not exist", async () => {
      const { service, prisma } = createService();
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toMatchObject({
        errorCode: "DEPARTMENT_NOT_FOUND"
      });
    });
  });

  describe("create", () => {
    it("rejects a managerId at creation time", async () => {
      const { service, prisma, audit } = createService();

      await expect(
        service.create({ code: "ENG", name: "Engineering", managerId: 5 } as never, actor)
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
      expect(prisma.department.create).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it("requires an existing parent department", async () => {
      const { service, prisma } = createService();
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ code: "ENG", name: "Engineering", parentId: 42 } as never, actor)
      ).rejects.toMatchObject({ errorCode: "DEPARTMENT_NOT_FOUND" });
      expect(prisma.department.create).not.toHaveBeenCalled();
    });

    it("creates and audit-logs a valid department", async () => {
      const { service, prisma, audit } = createService();
      prisma.department.create.mockResolvedValue({ id: 1, code: "ENG", name: "Engineering" });

      const result = await service.create(
        { code: "ENG", name: "Engineering" } as never,
        actor
      );

      expect(result).toMatchObject({ id: 1, code: "ENG" });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE_DEPARTMENT", entityId: 1 })
      );
    });
  });

  describe("update", () => {
    it("rejects a department being its own parent", async () => {
      const { service, prisma } = createService();
      prisma.department.findFirst.mockResolvedValue({ id: 1, parentId: null });

      await expect(
        service.update(1, { parentId: 1 } as never, actor)
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it("rejects a parent cycle (parent is a descendant of the department)", async () => {
      const { service, prisma } = createService();
      // findOne(1) -> department 1 exists
      // ensureParent(2) -> department 2 exists
      // ensureNoParentCycle(1, 2) walks up from 2: 2 -> parentId 1 (cycle back to department 1)
      prisma.department.findFirst
        .mockResolvedValueOnce({ id: 1, parentId: null }) // findOne(1)
        .mockResolvedValueOnce({ id: 2 }) // ensureParent(2)
        .mockResolvedValueOnce({ parentId: 1 }); // ensureNoParentCycle walk: currentId=2

      await expect(
        service.update(1, { parentId: 2 } as never, actor)
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it("rejects a manager who does not belong to the department", async () => {
      const { service, prisma } = createService();
      prisma.department.findFirst.mockResolvedValue({ id: 1, parentId: null });
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.update(1, { managerId: 99 } as never, actor)
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
      expect(prisma.department.update).not.toHaveBeenCalled();
    });
  });

  describe("softDelete", () => {
    it("deactivates the department and audit-logs the change", async () => {
      const { service, prisma, audit } = createService();
      prisma.department.findFirst.mockResolvedValue({ id: 1, parentId: null, isActive: true });
      prisma.department.update.mockResolvedValue({ id: 1, isActive: false });

      const result = await service.softDelete(1, actor);

      expect(result).toMatchObject({ isActive: false });
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false, deletedAt: expect.any(Date) }
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "DELETE_DEPARTMENT", entityId: 1 })
      );
    });
  });
});
