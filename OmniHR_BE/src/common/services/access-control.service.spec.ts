import { PrismaService } from "../../prisma/prisma.service";
import { AuthUser } from "../types";
import { AccessControlService } from "./access-control.service";

describe("AccessControlService", () => {
  function createService() {
    const prisma = {
      employee: { findFirst: jest.fn(), findMany: jest.fn() },
      employeeManager: { findMany: jest.fn().mockResolvedValue([]) },
      teamMember: { findMany: jest.fn().mockResolvedValue([]) },
      team: { findFirst: jest.fn(), findMany: jest.fn() },
      department: { findFirst: jest.fn() },
      project: { findFirst: jest.fn() },
      task: { findFirst: jest.fn() }
    };

    return {
      service: new AccessControlService(prisma as unknown as PrismaService),
      prisma
    };
  }

  function user(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
      id: 7,
      username: "manager01",
      email: "manager01@example.com",
      roles: ["MANAGER"],
      permissions: [],
      employeeId: 5,
      mustChangePassword: false,
      ...overrides
    };
  }

  const admin = () => user({ id: 1, roles: ["ADMIN"], employeeId: null });
  const employee = () => user({ id: 9, roles: ["EMPLOYEE"], employeeId: 20 });

  describe("ensureCanReadEmployee", () => {
    it("lets an admin read anyone", async () => {
      const { service, prisma } = createService();

      await expect(service.ensureCanReadEmployee(admin(), 999)).resolves.toBeUndefined();
      expect(prisma.employeeManager.findMany).not.toHaveBeenCalled();
    });

    it("lets an employee read their own record", async () => {
      const { service, prisma } = createService();

      await expect(service.ensureCanReadEmployee(employee(), 20)).resolves.toBeUndefined();
      expect(prisma.employeeManager.findMany).not.toHaveBeenCalled();
    });

    it("denies reading someone outside the manager's scope", async () => {
      const { service } = createService();

      await expect(service.ensureCanReadEmployee(user(), 999)).rejects.toMatchObject({
        errorCode: "MANAGER_SCOPE_DENIED"
      });
    });

    it("allows reading a direct subordinate", async () => {
      const { service, prisma } = createService();
      prisma.employeeManager.findMany.mockResolvedValue([{ employeeId: 42 }]);

      await expect(service.ensureCanReadEmployee(user(), 42)).resolves.toBeUndefined();
    });
  });

  describe("ensureCanManageLeave", () => {
    it("blocks a manager from approving their own leave request", async () => {
      const { service } = createService();

      await expect(service.ensureCanManageLeave(user(), 5)).rejects.toMatchObject({
        errorCode: "MANAGER_SCOPE_DENIED"
      });
    });

    it("still lets an admin approve their own leave request", async () => {
      const { service } = createService();
      const selfApprovingAdmin = user({ id: 1, roles: ["ADMIN"], employeeId: 5 });

      await expect(
        service.ensureCanManageLeave(selfApprovingAdmin, 5)
      ).resolves.toBeUndefined();
    });

    it("allows approving a subordinate's request", async () => {
      const { service, prisma } = createService();
      prisma.employeeManager.findMany.mockResolvedValue([{ employeeId: 42 }]);

      await expect(service.ensureCanManageLeave(user(), 42)).resolves.toBeUndefined();
    });

    it("denies approving someone outside the manager's scope", async () => {
      const { service } = createService();

      await expect(service.ensureCanManageLeave(user(), 999)).rejects.toMatchObject({
        errorCode: "MANAGER_SCOPE_DENIED"
      });
    });
  });

  describe("ensureCanReviewEmployee", () => {
    it("blocks a manager from writing their own performance review", async () => {
      const { service } = createService();

      await expect(service.ensureCanReviewEmployee(user(), 5)).rejects.toMatchObject({
        errorCode: "MANAGER_SCOPE_DENIED"
      });
    });

    it("allows reviewing a subordinate", async () => {
      const { service, prisma } = createService();
      prisma.employeeManager.findMany.mockResolvedValue([{ employeeId: 42 }]);

      await expect(service.ensureCanReviewEmployee(user(), 42)).resolves.toBeUndefined();
    });

    it("denies reviewing someone outside the manager's scope", async () => {
      const { service } = createService();

      await expect(service.ensureCanReviewEmployee(user(), 999)).rejects.toMatchObject({
        errorCode: "MANAGER_SCOPE_DENIED"
      });
    });
  });

  describe("teamEmployeeIds", () => {
    it("returns nothing for a user with no employee profile", async () => {
      const { service, prisma } = createService();

      await expect(service.teamEmployeeIds(user({ employeeId: null }))).resolves.toEqual([]);
      expect(prisma.employeeManager.findMany).not.toHaveBeenCalled();
    });

    it("merges direct reports with led-team members and de-duplicates", async () => {
      const { service, prisma } = createService();
      prisma.employeeManager.findMany.mockResolvedValue([
        { employeeId: 42 },
        { employeeId: 43 }
      ]);
      prisma.teamMember.findMany.mockResolvedValue([
        { employeeId: 43 },
        { employeeId: 44 }
      ]);
      // Not a department head, so the department branch adds nothing.
      prisma.employee.findFirst.mockResolvedValue({ departmentId: 3 });
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.teamEmployeeIds(user())).resolves.toEqual([42, 43, 44]);
    });

    it("does not widen a non-manager's scope to their whole department", async () => {
      const { service, prisma } = createService();
      prisma.employeeManager.findMany.mockResolvedValue([{ employeeId: 42 }]);
      prisma.teamMember.findMany.mockResolvedValue([]);

      const result = await service.teamEmployeeIds(employee());

      expect(result).toEqual([42]);
      // The department lookups are manager-only and must not even be attempted.
      expect(prisma.department.findFirst).not.toHaveBeenCalled();
      expect(prisma.employee.findMany).not.toHaveBeenCalled();
    });

    it("excludes other managers from a department head's scope", async () => {
      const { service, prisma } = createService();
      prisma.employee.findFirst.mockResolvedValue({ departmentId: 3 });
      prisma.department.findFirst.mockResolvedValue({ id: 3 });
      prisma.employee.findMany.mockResolvedValue([
        { id: 50, position: { code: "BE_DEV", name: "Backend Developer" } },
        { id: 51, position: { code: "IT_MANAGER", name: "IT Manager" } }
      ]);

      const result = await service.teamEmployeeIds(user());

      expect(result).toContain(50);
      expect(result).not.toContain(51);
    });
  });

  describe("ensureCanReadTask", () => {
    function task(overrides: Record<string, unknown> = {}) {
      return {
        parentTaskId: 1,
        projectId: 2,
        departmentId: 3,
        teamId: 4,
        assigneeId: null,
        createdByUserId: 999,
        project: { departmentId: 3 },
        team: { leadId: 999, members: [] },
        ...overrides
      };
    }

    it("throws TASK_NOT_FOUND before any scope check", async () => {
      const { service, prisma } = createService();
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.ensureCanReadTask(admin(), 100)).rejects.toMatchObject({
        errorCode: "TASK_NOT_FOUND"
      });
    });

    it("lets the assignee read their own task", async () => {
      const { service, prisma } = createService();
      prisma.task.findFirst.mockResolvedValue(task({ assigneeId: 20 }));

      await expect(service.ensureCanReadTask(employee(), 100)).resolves.toBeTruthy();
    });

    it("lets an active team member read a team task", async () => {
      const { service, prisma } = createService();
      prisma.task.findFirst.mockResolvedValue(
        task({ team: { leadId: 999, members: [{ employeeId: 20 }] } })
      );

      await expect(service.ensureCanReadTask(employee(), 100)).resolves.toBeTruthy();
    });

    it("denies an unrelated employee", async () => {
      const { service, prisma } = createService();
      prisma.task.findFirst.mockResolvedValue(task());
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.ensureCanReadTask(employee(), 100)).rejects.toMatchObject({
        errorCode: "TASK_ASSIGNMENT_DENIED"
      });
    });
  });

  describe("ensureCanAssignTask", () => {
    it("refuses to assign a team-level task to a person", async () => {
      const { service, prisma } = createService();
      prisma.task.findFirst.mockResolvedValue({
        parentTaskId: null,
        projectId: 2,
        departmentId: 3,
        teamId: 4,
        assigneeId: null,
        createdByUserId: 1,
        project: { departmentId: 3 },
        team: { leadId: null, members: [] }
      });

      await expect(service.ensureCanAssignTask(admin(), 100, 42)).rejects.toMatchObject({
        errorCode: "ROOT_TASK_CANNOT_BE_ASSIGNED"
      });
    });

    it("refuses an assignee outside the manager's scope", async () => {
      const { service, prisma } = createService();
      prisma.task.findFirst.mockResolvedValue({
        parentTaskId: 1,
        projectId: 2,
        departmentId: 3,
        teamId: 4,
        assigneeId: null,
        createdByUserId: user().id,
        project: { departmentId: 3 },
        team: { leadId: 5, members: [] }
      });
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.team.findFirst.mockResolvedValue({ id: 4 });
      prisma.employee.findFirst.mockResolvedValue({ id: 999 });

      await expect(service.ensureCanAssignTask(user(), 100, 999)).rejects.toMatchObject({
        errorCode: "TASK_ASSIGNEE_NOT_IN_MANAGER_SCOPE"
      });
    });
  });

  describe("ensureCanGenerateTaskSuggestion", () => {
    it("denies a plain employee before looking the task up", async () => {
      const { service, prisma } = createService();

      await expect(
        service.ensureCanGenerateTaskSuggestion(employee(), 100)
      ).rejects.toMatchObject({ errorCode: "TASK_ASSIGNMENT_DENIED" });
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("candidateEmployeeIdsForTask", () => {
    it("returns nothing for a plain employee", async () => {
      const { service, prisma } = createService();

      await expect(service.candidateEmployeeIdsForTask(employee())).resolves.toEqual([]);
      expect(prisma.employee.findMany).not.toHaveBeenCalled();
    });

    it("includes the manager themselves alongside their scope", async () => {
      const { service, prisma } = createService();
      prisma.employeeManager.findMany.mockResolvedValue([{ employeeId: 42 }]);
      prisma.employee.findFirst.mockResolvedValue({ departmentId: null });
      prisma.employee.findMany.mockResolvedValue([{ id: 5 }, { id: 42 }]);

      await service.candidateEmployeeIdsForTask(user());

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [5, 42] } })
        })
      );
    });
  });

  describe("ensureCanUpdateEmployeeSkill", () => {
    it("lets an employee edit their own skills", async () => {
      const { service } = createService();

      await expect(
        service.ensureCanUpdateEmployeeSkill(employee(), 20)
      ).resolves.toBeUndefined();
    });

    it("denies editing another employee's skills", async () => {
      const { service } = createService();

      await expect(
        service.ensureCanUpdateEmployeeSkill(employee(), 21)
      ).rejects.toMatchObject({ errorCode: "MANAGER_SCOPE_DENIED" });
    });
  });
});
