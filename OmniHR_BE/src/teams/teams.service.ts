import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EmployeeStatus,
  Prisma,
  ProjectStatus,
  TaskStatus,
  TeamMemberRole
} from "@prisma/client";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { pagination, toDateOnly } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { AddTeamMemberDto } from "./dto/add-team-member.dto";
import { CreateTeamDto } from "./dto/create-team.dto";
import { TeamQueryDto } from "./dto/team-query.dto";
import { UpdateTeamDto } from "./dto/update-team.dto";
import { UpdateTeamMemberDto } from "./dto/update-team-member.dto";

const teamInclude = {
  department: true,
  lead: { include: { department: true, position: true } },
  members: {
    where: { isActive: true, employee: currentEmployeeWhere() },
    include: { employee: { include: { department: true, position: true } } },
    orderBy: [{ role: "asc" }, { employee: { fullName: "asc" } }]
  },
  _count: {
    select: {
      members: { where: { isActive: true, employee: currentEmployeeWhere() } },
      projects: { where: { deletedAt: null } },
      tasks: { where: { deletedAt: null } }
    }
  }
} satisfies Prisma.TeamInclude;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async findAll(query: TeamQueryDto, actor: AuthUser) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where: Prisma.TeamWhereInput = this.scopedTeamWhere(actor, {
      deletedAt: null,
      departmentId: query.departmentId,
      leadId: query.leadId,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.team.findMany({
        where,
        include: teamInclude,
        orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
        skip,
        take
      }),
      this.prisma.team.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  async findOne(id: number, actor?: AuthUser) {
    const team = await this.prisma.team.findFirst({
      where: actor ? this.scopedTeamWhere(actor, { id, deletedAt: null }) : { id, deletedAt: null },
      include: teamInclude
    });
    if (!team) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
    }
    return team;
  }

  async create(dto: CreateTeamDto, actor: AuthUser, context?: RequestContext) {
    await this.ensureDepartment(dto.departmentId);
    await this.ensureCanManageDepartment(actor, dto.departmentId);
    await this.ensureEmployeesInDepartment(this.memberIds(dto.memberIds, dto.leadId), dto.departmentId);

    const team = await this.prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          departmentId: dto.departmentId,
          leadId: dto.leadId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive ?? true
        }
      });
      await this.syncMembers(tx, created.id, dto.departmentId, dto.leadId, dto.memberIds);
      return tx.team.findUniqueOrThrow({ where: { id: created.id }, include: teamInclude });
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_TEAM",
      entityType: "Team",
      entityId: team.id,
      newValue: team,
      context
    });

    return team;
  }

  async update(id: number, dto: UpdateTeamDto, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id, actor);
    const departmentId = dto.departmentId ?? oldValue.departmentId;
    await this.ensureDepartment(departmentId);
    await this.ensureCanManageDepartment(actor, oldValue.departmentId);
    await this.ensureCanManageDepartment(actor, departmentId);

    const employeeIds =
      dto.memberIds !== undefined
        ? this.memberIds(dto.memberIds, dto.leadId ?? oldValue.leadId ?? undefined)
        : this.memberIds(
            oldValue.members.map((member) => member.employeeId),
            dto.leadId ?? oldValue.leadId ?? undefined
          );
    await this.ensureEmployeesInDepartment(employeeIds, departmentId);

    const team = await this.prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id },
        data: {
          departmentId: dto.departmentId,
          leadId: dto.leadId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive
        }
      });

      if (dto.memberIds !== undefined) {
        await this.syncMembers(tx, id, departmentId, dto.leadId ?? oldValue.leadId ?? undefined, dto.memberIds);
      } else if (dto.leadId !== undefined) {
        await this.ensureLeadMembership(tx, id, dto.leadId);
        await this.downgradePreviousLead(tx, id, oldValue.leadId, dto.leadId);
      }

      return tx.team.findUniqueOrThrow({ where: { id }, include: teamInclude });
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_TEAM",
      entityType: "Team",
      entityId: id,
      oldValue,
      newValue: team,
      context
    });

    return team;
  }

  async softDelete(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id, actor);
    await this.ensureCanManageDepartment(actor, oldValue.departmentId);
    const activeProjects = await this.prisma.project.count({
      where: {
        teamId: id,
        deletedAt: null,
        status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] }
      }
    });
    const activeTasks = await this.prisma.task.count({
      where: {
        teamId: id,
        deletedAt: null,
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
      }
    });
    if (activeProjects || activeTasks) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Team has active projects or tasks",
        "VALIDATION_ERROR"
      );
    }

    const team = await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.updateMany({
        where: { teamId: id, isActive: true },
        data: { isActive: false, leftAt: toDateOnly(new Date()) }
      });
      return tx.team.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
        include: teamInclude
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_TEAM",
      entityType: "Team",
      entityId: id,
      oldValue,
      newValue: team,
      context
    });

    return team;
  }

  async addMember(
    teamId: number,
    dto: AddTeamMemberDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const team = await this.findOne(teamId, actor);
    await this.ensureCanManageDepartment(actor, team.departmentId);
    await this.ensureEmployeesInDepartment([dto.employeeId], team.departmentId);

    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.teamMember.upsert({
        where: { teamId_employeeId: { teamId, employeeId: dto.employeeId } },
        create: {
          teamId,
          employeeId: dto.employeeId,
          role: dto.role ?? TeamMemberRole.MEMBER,
          isActive: true
        },
        update: {
          role: dto.role ?? TeamMemberRole.MEMBER,
          isActive: true,
          leftAt: null
        }
      });
      if (member.role === TeamMemberRole.LEAD) {
        await tx.team.update({ where: { id: teamId }, data: { leadId: dto.employeeId } });
      }
      return tx.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude });
    });

    await this.audit.log({
      userId: actor.id,
      action: "ADD_TEAM_MEMBER",
      entityType: "Team",
      entityId: teamId,
      newValue: result,
      context
    });

    return result;
  }

  async updateMember(
    teamId: number,
    memberId: number,
    dto: UpdateTeamMemberDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const team = await this.findOne(teamId, actor);
    await this.ensureCanManageDepartment(actor, team.departmentId);
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.teamMember.findFirst({
        where: { id: memberId, teamId },
        select: { id: true }
      });
      if (!existing) {
        throw new ApiError(HttpStatus.NOT_FOUND, "Team member not found", "TEAM_MEMBER_NOT_FOUND");
      }
      const member = await tx.teamMember.update({
        where: { id: memberId },
        data: {
          role: dto.role,
          isActive: dto.isActive,
          leftAt: dto.isActive === false ? toDateOnly(new Date()) : dto.isActive === true ? null : undefined
        }
      });
      if (member.role === TeamMemberRole.LEAD && member.isActive) {
        await tx.team.update({ where: { id: teamId }, data: { leadId: member.employeeId } });
      }
      return tx.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude });
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_TEAM_MEMBER",
      entityType: "Team",
      entityId: teamId,
      newValue: result,
      context
    });

    return result;
  }

  async removeMember(
    teamId: number,
    memberId: number,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(teamId, actor);
    await this.ensureCanManageDepartment(actor, oldValue.departmentId);
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.teamMember.findFirst({
        where: { id: memberId, teamId },
        select: { id: true }
      });
      if (!existing) {
        throw new ApiError(HttpStatus.NOT_FOUND, "Team member not found", "TEAM_MEMBER_NOT_FOUND");
      }
      const member = await tx.teamMember.update({
        where: { id: memberId },
        data: { isActive: false, leftAt: toDateOnly(new Date()) }
      });
      if (oldValue.leadId === member.employeeId) {
        await tx.team.update({ where: { id: teamId }, data: { leadId: null } });
      }
      return tx.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude });
    });

    await this.audit.log({
      userId: actor.id,
      action: "REMOVE_TEAM_MEMBER",
      entityType: "Team",
      entityId: teamId,
      oldValue,
      newValue: result,
      context
    });

    return result;
  }

  private memberIds(memberIds?: number[], leadId?: number) {
    return Array.from(new Set([...(memberIds ?? []), ...(leadId ? [leadId] : [])]));
  }

  private scopedTeamWhere(actor: AuthUser, base: Prisma.TeamWhereInput): Prisma.TeamWhereInput {
    if (actor.roles.includes("ADMIN")) {
      return base;
    }

    if (!actor.employeeId) {
      return { AND: [base, { id: -1 }] };
    }

    return {
      AND: [
        base,
        {
          OR: [
            { department: { managerId: actor.employeeId } },
            { leadId: actor.employeeId },
            { members: { some: { employeeId: actor.employeeId, isActive: true } } }
          ]
        }
      ]
    };
  }

  private async ensureCanManageDepartment(actor: AuthUser, departmentId: number) {
    if (actor.roles.includes("ADMIN")) {
      return;
    }

    if (!actor.employeeId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "Department scope denied", "DEPARTMENT_SCOPE_DENIED");
    }

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, deletedAt: null, managerId: actor.employeeId },
      select: { id: true }
    });
    if (!department) {
      throw new ApiError(HttpStatus.FORBIDDEN, "Department scope denied", "DEPARTMENT_SCOPE_DENIED");
    }
  }

  private async ensureDepartment(id: number) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true }
    });
    if (!department) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Department not found", "DEPARTMENT_NOT_FOUND");
    }
  }

  private async ensureEmployeesInDepartment(employeeIds: number[], departmentId: number) {
    if (!employeeIds.length) {
      return;
    }

    const employees = await this.prisma.employee.findMany({
      where: currentEmployeeWhere({
        id: { in: employeeIds },
        departmentId,
        status: EmployeeStatus.ACTIVE
      }),
      select: { id: true }
    });
    if (employees.length !== employeeIds.length) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Team lead and members must belong to the selected department",
        "VALIDATION_ERROR"
      );
    }
  }

  private async syncMembers(
    tx: Prisma.TransactionClient,
    teamId: number,
    departmentId: number,
    leadId?: number,
    memberIds: number[] = []
  ) {
    const targetIds = this.memberIds(memberIds, leadId);
    await this.ensureEmployeesInDepartment(targetIds, departmentId);
    await tx.teamMember.updateMany({
      where: {
        teamId,
        isActive: true,
        ...(targetIds.length ? { employeeId: { notIn: targetIds } } : {})
      },
      data: { isActive: false, leftAt: toDateOnly(new Date()) }
    });

    for (const employeeId of targetIds) {
      await tx.teamMember.upsert({
        where: { teamId_employeeId: { teamId, employeeId } },
        create: {
          teamId,
          employeeId,
          role: employeeId === leadId ? TeamMemberRole.LEAD : TeamMemberRole.MEMBER,
          isActive: true
        },
        update: {
          role: employeeId === leadId ? TeamMemberRole.LEAD : TeamMemberRole.MEMBER,
          isActive: true,
          leftAt: null
        }
      });
    }
  }

  private async ensureLeadMembership(
    tx: Prisma.TransactionClient,
    teamId: number,
    leadId?: number
  ) {
    if (!leadId) {
      return;
    }

    await tx.teamMember.upsert({
      where: { teamId_employeeId: { teamId, employeeId: leadId } },
      create: { teamId, employeeId: leadId, role: TeamMemberRole.LEAD, isActive: true },
      update: { role: TeamMemberRole.LEAD, isActive: true, leftAt: null }
    });
  }

  private async downgradePreviousLead(
    tx: Prisma.TransactionClient,
    teamId: number,
    oldLeadId?: number | null,
    newLeadId?: number
  ) {
    if (!oldLeadId || oldLeadId === newLeadId) {
      return;
    }

    await tx.teamMember.updateMany({
      where: { teamId, employeeId: oldLeadId, isActive: true },
      data: { role: TeamMemberRole.MEMBER }
    });
  }
}
