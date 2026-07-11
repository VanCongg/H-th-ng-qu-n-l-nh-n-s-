"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeSkillsService = void 0;
const common_1 = require("@nestjs/common");
const api_error_1 = require("../common/api-error");
const access_control_service_1 = require("../common/services/access-control.service");
const audit_service_1 = require("../common/services/audit.service");
const prisma_where_1 = require("../common/prisma-where");
const utils_1 = require("../common/utils");
const prisma_service_1 = require("../prisma/prisma.service");
const employeeSkillInclude = {
    employee: { include: { department: true, position: true } },
    skill: true
};
let EmployeeSkillsService = class EmployeeSkillsService {
    prisma;
    audit;
    accessControl;
    constructor(prisma, audit, accessControl) {
        this.prisma = prisma;
        this.audit = audit;
        this.accessControl = accessControl;
    }
    async findByEmployee(employeeId, user) {
        await this.accessControl.ensureCanReadEmployeeSkill(user, employeeId);
        await this.ensureEmployee(employeeId);
        return this.prisma.employeeSkill.findMany({
            where: { employeeId },
            include: employeeSkillInclude,
            orderBy: [{ skill: { code: "asc" } }]
        });
    }
    async create(employeeId, dto, actor, context) {
        await this.accessControl.ensureCanUpdateEmployeeSkill(actor, employeeId);
        await this.ensureSkillForEmployee(dto.skillId, employeeId);
        this.ensureLastUsedAt(dto.lastUsedAt);
        const employeeSkill = await this.prisma.employeeSkill.create({
            data: {
                employeeId,
                skillId: dto.skillId,
                yearsExperience: dto.yearsExperience,
                proficiency: dto.proficiency,
                lastUsedAt: dto.lastUsedAt ? (0, utils_1.toDateOnly)(dto.lastUsedAt) : undefined,
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
    async update(id, dto, actor, context) {
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
                lastUsedAt: dto.lastUsedAt ? (0, utils_1.toDateOnly)(dto.lastUsedAt) : undefined,
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
    async remove(id, actor, context) {
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
    async findOne(id) {
        const employeeSkill = await this.prisma.employeeSkill.findUnique({
            where: { id },
            include: employeeSkillInclude
        });
        if (!employeeSkill) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee skill not found", "EMPLOYEE_SKILL_NOT_FOUND");
        }
        return employeeSkill;
    }
    async ensureEmployee(id) {
        const employee = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id }),
            select: { id: true, positionId: true }
        });
        if (!employee) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        return employee;
    }
    async ensureSkillForEmployee(skillId, employeeId) {
        const employee = await this.ensureEmployee(employeeId);
        if (!employee.positionId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Employee position is required before assigning skills", "VALIDATION_ERROR");
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
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Skill is not applicable to employee position", "VALIDATION_ERROR");
        }
    }
    ensureLastUsedAt(lastUsedAt) {
        if (lastUsedAt && (0, utils_1.toDateOnly)(lastUsedAt) > (0, utils_1.toDateOnly)(new Date())) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Last used date cannot be in the future", "EMPLOYEE_SKILL_LAST_USED_INVALID");
        }
    }
};
exports.EmployeeSkillsService = EmployeeSkillsService;
exports.EmployeeSkillsService = EmployeeSkillsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        access_control_service_1.AccessControlService])
], EmployeeSkillsService);
//# sourceMappingURL=employee-skills.service.js.map