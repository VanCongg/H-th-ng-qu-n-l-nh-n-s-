import { HttpStatus, Injectable } from "@nestjs/common";
import { EmployeeStatus, TeamMemberRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiError } from "../api-error";
import { currentEmployeeWhere } from "../prisma-where";
import { isManagerPosition } from "../position-role";
import { AuthUser } from "../types";
import { toDateOnly } from "../utils";

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthUser) {
    return user.roles.includes("ADMIN");
  }

  isManager(user: AuthUser) {
    return user.roles.includes("MANAGER");
  }

  async ensureCanReadEmployee(user: AuthUser, employeeId: number) {
    if (this.isAdmin(user)) {
      return;
    }

    if (user.employeeId === employeeId) {
      return;
    }

    if (await this.isSubordinate(user, employeeId)) {
      return;
    }

    throw new ApiError(
      HttpStatus.FORBIDDEN,
      "Manager scope denied",
      "MANAGER_SCOPE_DENIED"
    );
  }

  async ensureCanManageLeave(user: AuthUser, employeeId: number) {
    if (this.isAdmin(user)) {
      return;
    }

    if (user.employeeId === employeeId) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "You cannot approve or reject your own leave request",
        "MANAGER_SCOPE_DENIED"
      );
    }

    if (!(await this.isSubordinate(user, employeeId))) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "Manager scope denied",
        "MANAGER_SCOPE_DENIED"
      );
    }
  }

  async teamEmployeeIds(user: AuthUser): Promise<number[]> {
    if (!user.employeeId) {
      return [];
    }

    const today = toDateOnly(new Date());
    const manualRows = await this.prisma.employeeManager.findMany({
      where: {
        managerId: user.employeeId,
        isActive: true,
        employee: currentEmployeeWhere(),
        manager: currentEmployeeWhere(),
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      select: { employeeId: true }
    });

    const manualIds = manualRows.map((row) => row.employeeId);
    const ledTeamRows = await this.prisma.teamMember.findMany({
      where: {
        isActive: true,
        employeeId: { not: user.employeeId },
        employee: currentEmployeeWhere({ status: EmployeeStatus.ACTIVE }),
        team: {
          deletedAt: null,
          isActive: true,
          OR: [
            { leadId: user.employeeId },
            {
              members: {
                some: {
                  employeeId: user.employeeId,
                  isActive: true,
                  role: TeamMemberRole.LEAD
                }
              }
            }
          ]
        }
      },
      select: { employeeId: true }
    });
    const ledTeamIds = ledTeamRows.map((row) => row.employeeId);

    if (!this.isManager(user)) {
      return Array.from(new Set([...manualIds, ...ledTeamIds]));
    }

    const manager = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({
        id: user.employeeId,
        status: EmployeeStatus.ACTIVE
      }),
      select: { departmentId: true }
    });
    if (!manager?.departmentId) {
      return Array.from(new Set([...manualIds, ...ledTeamIds]));
    }

    const managedDepartment = await this.prisma.department.findFirst({
      where: {
        id: manager.departmentId,
        deletedAt: null,
        managerId: user.employeeId
      },
      select: { id: true }
    });
    if (!managedDepartment) {
      return Array.from(new Set([...manualIds, ...ledTeamIds]));
    }

    const departmentRows = await this.prisma.employee.findMany({
      where: currentEmployeeWhere({
        departmentId: manager.departmentId,
        id: { not: user.employeeId },
        status: EmployeeStatus.ACTIVE,
        OR: [
          { userId: null },
          {
            user: {
              is: {
                userRoles: {
                  none: { role: { name: "MANAGER" } }
                }
              }
            }
          }
        ]
      }),
      select: {
        id: true,
        position: {
          select: { code: true, name: true }
        }
      }
    });

    const departmentIds = departmentRows
      .filter((employee) => !isManagerPosition(employee.position))
      .map((employee) => employee.id);

    return Array.from(new Set([...manualIds, ...ledTeamIds, ...departmentIds]));
  }

  async managedTeamIds(user: AuthUser): Promise<number[]> {
    if (!user.employeeId) {
      return [];
    }

    const teams = await this.prisma.team.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { leadId: user.employeeId },
          {
            members: {
              some: {
                employeeId: user.employeeId,
                isActive: true,
                role: TeamMemberRole.LEAD
              }
            }
          }
        ]
      },
      select: { id: true }
    });

    return teams.map((team) => team.id);
  }

  async isDepartmentHead(user: AuthUser, departmentId: number): Promise<boolean> {
    if (!user.employeeId) {
      return false;
    }
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        managerId: user.employeeId,
        isActive: true,
        deletedAt: null
      },
      select: { id: true }
    });
    return Boolean(department);
  }

  async isTeamLead(user: AuthUser, teamId: number): Promise<boolean> {
    if (!user.employeeId) {
      return false;
    }
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        isActive: true,
        deletedAt: null,
        OR: [
          { leadId: user.employeeId },
          {
            members: {
              some: {
                employeeId: user.employeeId,
                isActive: true,
                role: TeamMemberRole.LEAD
              }
            }
          }
        ]
      },
      select: { id: true }
    });
    return Boolean(team);
  }

  async isSubordinate(user: AuthUser, employeeId: number): Promise<boolean> {
    if (!user.employeeId) {
      return false;
    }

    const teamIds = await this.teamEmployeeIds(user);
    return teamIds.includes(employeeId);
  }

  async ensureCanReadProject(user: AuthUser, projectId: number) {
    if (this.isAdmin(user)) {
      return;
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        department: { select: { managerId: true } },
        tasks: {
          where: { deletedAt: null },
          select: {
            assigneeId: true,
            createdByUserId: true,
            team: {
              select: {
                leadId: true,
                members: {
                  where: { isActive: true },
                  select: { employeeId: true }
                }
              }
            }
          }
        }
      }
    });
    if (!project) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Project not found", "PROJECT_NOT_FOUND");
    }

    if (
      project.managerId === user.employeeId ||
      project.department.managerId === user.employeeId ||
      project.createdByUserId === user.id
    ) {
      return;
    }

    if (
      project.tasks.some(
        (task) =>
          task.assigneeId === user.employeeId ||
          task.createdByUserId === user.id ||
          task.team?.leadId === user.employeeId ||
          task.team?.members.some((member) => member.employeeId === user.employeeId)
      )
    ) {
      return;
    }

    throw new ApiError(HttpStatus.FORBIDDEN, "Project scope denied", "PROJECT_SCOPE_DENIED");
  }

  async ensureCanReadTask(user: AuthUser, taskId: number) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        parentTaskId: true,
        projectId: true,
        departmentId: true,
        teamId: true,
        assigneeId: true,
        createdByUserId: true,
        project: {
          select: { departmentId: true }
        },
        team: {
          select: {
            leadId: true,
            members: {
              where: { isActive: true },
              select: { employeeId: true }
            }
          }
        }
      }
    });
    if (!task) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Task not found", "TASK_NOT_FOUND");
    }

    if (this.isAdmin(user)) {
      return task;
    }

    if (task.assigneeId && task.assigneeId === user.employeeId) {
      return task;
    }

    if (
      task.createdByUserId === user.id ||
      task.team?.leadId === user.employeeId ||
      task.team?.members.some((member) => member.employeeId === user.employeeId) ||
      (task.departmentId && (await this.isDepartmentHead(user, task.departmentId)))
    ) {
      return task;
    }

    throw new ApiError(HttpStatus.FORBIDDEN, "Task scope denied", "TASK_ASSIGNMENT_DENIED");
  }

  async ensureCanUpdateTask(user: AuthUser, taskId: number) {
    const task = await this.ensureCanReadTask(user, taskId);
    if (this.isAdmin(user)) {
      return task;
    }

    if (task.departmentId && (await this.isDepartmentHead(user, task.departmentId))) {
      return task;
    }

    if (task.parentTaskId && task.teamId && (await this.isTeamLead(user, task.teamId))) {
      return task;
    }

    throw new ApiError(HttpStatus.FORBIDDEN, "Task update denied", "TASK_ASSIGNMENT_DENIED");
  }

  async ensureCanUpdateTaskStatus(user: AuthUser, taskId: number) {
    const task = await this.ensureCanReadTask(user, taskId);
    if (this.isAdmin(user) || task.assigneeId === user.employeeId) {
      return task;
    }

    if (task.departmentId && (await this.isDepartmentHead(user, task.departmentId))) {
      return task;
    }

    if (task.teamId && (await this.isTeamLead(user, task.teamId))) {
      return task;
    }

    throw new ApiError(HttpStatus.FORBIDDEN, "Task status update denied", "TASK_ASSIGNMENT_DENIED");
  }

  async ensureCanAssignToEmployee(user: AuthUser, employeeId: number) {
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id: employeeId, status: EmployeeStatus.ACTIVE }),
      select: { id: true }
    });
    if (!employee) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
    }

    if (this.isAdmin(user)) {
      return;
    }

    if (user.employeeId === employeeId) {
      return;
    }

    if (this.isManager(user) && (await this.isSubordinate(user, employeeId))) {
      return;
    }

    throw new ApiError(
      HttpStatus.FORBIDDEN,
      "Task assignee is outside manager scope",
      "TASK_ASSIGNEE_NOT_IN_MANAGER_SCOPE"
    );
  }

  async ensureCanAssignTask(user: AuthUser, taskId: number, employeeId: number) {
    const task = await this.ensureCanUpdateTask(user, taskId);
    if (!task.parentTaskId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "A team-level task cannot be assigned to an employee",
        "ROOT_TASK_CANNOT_BE_ASSIGNED"
      );
    }
    await this.ensureCanAssignToEmployee(user, employeeId);
  }

  async candidateEmployeeIdsForTask(user: AuthUser): Promise<number[]> {
    if (this.isAdmin(user)) {
      const employees = await this.prisma.employee.findMany({
        where: currentEmployeeWhere({ status: EmployeeStatus.ACTIVE }),
        select: { id: true }
      });
      return employees.map((employee) => employee.id);
    }

    if (this.isManager(user)) {
      const teamIds = Array.from(
        new Set([
          ...(user.employeeId ? [user.employeeId] : []),
          ...(await this.teamEmployeeIds(user))
        ])
      );
      if (!teamIds.length) {
        return [];
      }
      const employees = await this.prisma.employee.findMany({
        where: {
          ...currentEmployeeWhere({ status: EmployeeStatus.ACTIVE }),
          id: { in: teamIds }
        },
        select: { id: true }
      });
      return employees.map((employee) => employee.id);
    }

    return [];
  }

  async ensureCanGenerateTaskSuggestion(user: AuthUser, taskId: number) {
    if (!this.isAdmin(user) && !this.isManager(user)) {
      throw new ApiError(HttpStatus.FORBIDDEN, "AI suggestion denied", "TASK_ASSIGNMENT_DENIED");
    }
    await this.ensureCanReadTask(user, taskId);
  }

  async ensureCanReadEmployeeSkill(user: AuthUser, employeeId: number) {
    await this.ensureCanReadEmployee(user, employeeId);
  }

  async ensureCanUpdateEmployeeSkill(user: AuthUser, employeeId: number) {
    if (this.isAdmin(user)) {
      return;
    }

    if (user.employeeId === employeeId) {
      return;
    }

    if (this.isManager(user) && (await this.isSubordinate(user, employeeId))) {
      return;
    }

    throw new ApiError(
      HttpStatus.FORBIDDEN,
      "Employee skill update denied",
      "MANAGER_SCOPE_DENIED"
    );
  }
}
