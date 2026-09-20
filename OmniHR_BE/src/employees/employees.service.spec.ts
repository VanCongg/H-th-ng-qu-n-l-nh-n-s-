import { ConfigService } from "@nestjs/config";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { createFakeCache } from "../redis/cache.service.fake";
import { EmployeesService } from "./employees.service";

describe("EmployeesService", () => {
  function createService() {
    const prisma = {
      employee: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn()
      },
      user: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      department: {
        findFirst: jest.fn()
      },
      position: {
        findFirst: jest.fn()
      },
      role: {
        findMany: jest.fn()
      },
      $transaction: jest.fn()
    };
    const config = {
      get: jest.fn()
    };
    const audit = {
      log: jest.fn()
    };
    const accessControl = {
      ensureCanReadEmployee: jest.fn()
    };

    return {
      service: new EmployeesService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService,
        audit as unknown as AuditService,
        accessControl as unknown as AccessControlService,
        createFakeCache().cache
      ),
      prisma,
      audit,
      accessControl
    };
  }

  const actor = {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    roles: ["ADMIN"],
    permissions: ["EMPLOYEE_UPDATE"],
    employeeId: null,
    mustChangePassword: false
  };

  function baseCreateDto(overrides: Record<string, unknown> = {}) {
    return {
      employeeCode: "EMP001",
      fullName: "Nguyen Van A",
      companyEmail: "a@omnihr.dev",
      birthDate: "1995-01-01",
      ...overrides
    } as never;
  }

  describe("findOne", () => {
    it("throws EMPLOYEE_NOT_FOUND when the employee does not exist", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toMatchObject({
        errorCode: "EMPLOYEE_NOT_FOUND"
      });
    });

    it("checks read access when a requesting user is provided", async () => {
      const { service, prisma, accessControl } = createService();
      prisma.employee.findFirst.mockResolvedValue({ id: 1, user: null });

      await service.findOne(1, actor as never);

      expect(accessControl.ensureCanReadEmployee).toHaveBeenCalledWith(actor, 1);
    });
  });

  describe("myProfile", () => {
    it("throws EMPLOYEE_NOT_FOUND when the user has no linked employee", async () => {
      const { service } = createService();

      await expect(
        service.myProfile({ ...actor, employeeId: null } as never)
      ).rejects.toMatchObject({ errorCode: "EMPLOYEE_NOT_FOUND" });
    });
  });

  describe("create", () => {
    it("rejects a company email already used by another employee", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue({ id: 5 });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.create(baseCreateDto(), actor as never)).rejects.toMatchObject({
        errorCode: "VALIDATION_ERROR"
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects a company email already used by another user account", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 9 });

      await expect(service.create(baseCreateDto(), actor as never)).rejects.toMatchObject({
        errorCode: "VALIDATION_ERROR"
      });
    });

    it("requires the department to exist", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.create(baseCreateDto({ departmentId: 7 }), actor as never)
      ).rejects.toMatchObject({ errorCode: "DEPARTMENT_NOT_FOUND" });
    });

    it("requires the position to exist", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.department.findFirst.mockResolvedValue({ id: 7 });
      prisma.position.findFirst.mockResolvedValue(null);

      await expect(
        service.create(baseCreateDto({ departmentId: 7, positionId: 3 }), actor as never)
      ).rejects.toMatchObject({ errorCode: "POSITION_NOT_FOUND" });
    });

    it("requires a department when a position is selected", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.position.findFirst.mockResolvedValue({
        id: 3,
        code: "DEV",
        name: "Developer",
        departmentId: null
      });

      await expect(
        service.create(baseCreateDto({ positionId: 3 }), actor as never)
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
    });

    it("rejects a position that belongs to a different department", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.department.findFirst.mockResolvedValue({ id: 7 });
      prisma.position.findFirst.mockResolvedValue({
        id: 3,
        code: "DEV",
        name: "Developer",
        departmentId: 8
      });

      await expect(
        service.create(baseCreateDto({ departmentId: 7, positionId: 3 }), actor as never)
      ).rejects.toMatchObject({ errorCode: "VALIDATION_ERROR" });
    });
  });

  describe("resetPassword", () => {
    it("throws EMPLOYEE_NOT_FOUND when the employee has no linked user", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(1, actor as never)).rejects.toMatchObject({
        errorCode: "EMPLOYEE_NOT_FOUND"
      });
    });
  });

  describe("setUserActive", () => {
    it("throws USER_NOT_FOUND when the employee has no linked user account", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue({ id: 1, user: null });

      await expect(
        service.setUserActive(1, false, actor as never)
      ).rejects.toMatchObject({ errorCode: "USER_NOT_FOUND" });
    });
  });
});
