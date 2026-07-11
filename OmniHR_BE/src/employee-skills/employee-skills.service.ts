import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { toDateOnly } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeSkillDto } from "./dto/create-employee-skill.dto";
import { UpdateEmployeeSkillDto } from "./dto/update-employee-skill.dto";

const employeeSkillInclude = {
  employee: { include: { department: true, position: true } },
  skill: true
} satisfies Prisma.EmployeeSkillInclude;

@Injectable()
export class EmployeeSkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService
  ) {}

  async findByEmployee(employeeId: number, user: AuthUser) {
    await this.accessControl.ensureCanReadEmployeeSkill(user, employeeId);
    await this.ensureEmployee(employeeId);

    return this.prisma.employeeSkill.findMany({
      where: { employeeId },
      include: employeeSkillInclude,
      orderBy: [{ skill: { code: "asc" } }]
    });
  }

  async create(
    employeeId: number,
    dto: CreateEmployeeSkillDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    await this.accessControl.ensureCanUpdateEmployeeSkill(actor, employeeId);
    await this.ensureSkillForEmployee(dto.skillId, employeeId);
    this.ensureLastUsedAt(dto.lastUsedAt);

    const employeeSkill = await this.prisma.employeeSkill.create({
      data: {
        employeeId,
        skillId: dto.skillId,
        yearsExperience: dto.yearsExperience,
        proficiency: dto.proficiency,
        lastUsedAt: dto.lastUsedAt ? toDateOnly(dto.lastUsedAt) : undefined,
        note: dto.note
      },
      include: employeeSkillInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "ADD_EMPLOYEE_SKILL",
      entityType: "EmployeeSkill",
      entityId: employeeSkill.id,
      newValue: employeeSkill,
      context
    });

    return employeeSkill;
  }

  async update(
    id: number,
    dto: UpdateEmployeeSkillDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    await this.accessControl.ensureCanUpdateEmployeeSkill(actor, oldValue.employeeId);
    if (dto.skillId) {
      await this.ensureSkillForEmployee(dto.skillId, oldValue.employeeId);
    }
    this.ensureLastUsedAt(dto.lastUsedAt);

    const employeeSkill = await this.prisma.employeeSkill.update({
      where: { id },
      data: {
        skillId: dto.skillId,
        yearsExperience: dto.yearsExperience,
        proficiency: dto.proficiency,
        lastUsedAt: dto.lastUsedAt ? toDateOnly(dto.lastUsedAt) : undefined,
        note: dto.note
      },
      include: employeeSkillInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_EMPLOYEE_SKILL",
      entityType: "EmployeeSkill",
      entityId: id,
      oldValue,
      newValue: employeeSkill,
      context
    });

    return employeeSkill;
  }

  async remove(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id);
    await this.accessControl.ensureCanUpdateEmployeeSkill(actor, oldValue.employeeId);
    await this.prisma.employeeSkill.delete({ where: { id } });

    await this.audit.log({
      userId: actor.id,
      action: "REMOVE_EMPLOYEE_SKILL",
      entityType: "EmployeeSkill",
      entityId: id,
      oldValue,
      context
    });

    return oldValue;
  }

  private async findOne(id: number) {
    const employeeSkill = await this.prisma.employeeSkill.findUnique({
      where: { id },
      include: employeeSkillInclude
    });
    if (!employeeSkill) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee skill not found",
        "EMPLOYEE_SKILL_NOT_FOUND"
      );
    }
    return employeeSkill;
  }

  private async ensureEmployee(id: number) {
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id }),
      select: { id: true, positionId: true }
    });
    if (!employee) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
    }
    return employee;
  }

  private async ensureSkillForEmployee(skillId: number, employeeId: number) {
    const employee = await this.ensureEmployee(employeeId);
    if (!employee.positionId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Employee position is required before assigning skills",
        "VALIDATION_ERROR"
      );
    }

    const skill = await this.prisma.skill.findFirst({
      where: {
        id: skillId,
        isActive: true,
        positionSkills: { some: { positionId: employee.positionId } }
      },
      select: { id: true }
    });
    if (!skill) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Skill is not applicable to employee position",
        "VALIDATION_ERROR"
      );
    }
  }

  private ensureLastUsedAt(lastUsedAt?: string) {
    if (lastUsedAt && toDateOnly(lastUsedAt) > toDateOnly(new Date())) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Last used date cannot be in the future",
        "EMPLOYEE_SKILL_LAST_USED_INVALID"
      );
    }
  }
}
