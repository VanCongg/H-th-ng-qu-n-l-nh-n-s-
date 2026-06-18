"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const access_control_service_1 = require("../common/services/access-control.service");
const prisma_where_1 = require("../common/prisma-where");
const position_role_1 = require("../common/position-role");
const utils_1 = require("../common/utils");
const employeeInclude = {
    department: true,
    position: true,
    employeeSkills: {
        include: { skill: true },
        orderBy: [{ skill: { code: "asc" } }]
    },
    user: {
        include: {
            userRoles: { include: { role: true } }
        }
    }
};
let EmployeesService = class EmployeesService {
    prisma;
    config;
    audit;
    accessControl;
    constructor(prisma, config, audit, accessControl) {
        this.prisma = prisma;
        this.config = config;
        this.audit = audit;
        this.accessControl = accessControl;
    }
    async findAll(query) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const where = this.buildWhere(query);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.employee.findMany({
                where,
                include: employeeInclude,
                orderBy: { createdAt: "desc" },
                skip,
                take
            }),
            this.prisma.employee.count({ where })
        ]);
        return {
            items: items.map((item) => this.safeEmployee(item)),
            meta: { total, page, limit }
        };
    }
    async findTeam(user, query) {
        const teamIds = await this.accessControl.teamEmployeeIds(user);
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const where = {
            ...this.buildWhere(query),
            id: { in: teamIds }
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.employee.findMany({
                where,
                include: employeeInclude,
                orderBy: { fullName: "asc" },
                skip,
                take
            }),
            this.prisma.employee.count({ where })
        ]);
        return {
            items: items.map((item) => this.safeEmployee(item)),
            meta: { total, page, limit }
        };
    }
    async findOne(id, user) {
        if (user) {
            await this.accessControl.ensureCanReadEmployee(user, id);
        }
        const employee = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id }),
            include: employeeInclude
        });
        if (!employee) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        return this.safeEmployee(employee);
    }
    async myProfile(user) {
        if (!user.employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        return this.findOne(user.employeeId, user);
    }
    async create(dto, actor, context) {
        const companyEmail = dto.companyEmail.toLowerCase();
        await this.ensureEmailAvailable(companyEmail);
        const references = await this.ensureDepartmentAndPosition(dto.departmentId, dto.positionId);
        const birthDate = (0, utils_1.toDateOnly)(dto.birthDate);
        const defaultPassword = (0, utils_1.formatDateDdMmYyyy)(birthDate);
        const passwordHash = await bcrypt.hash(defaultPassword, this.saltRounds());
        const roles = await this.rolesForPosition(references.position);
        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    username: companyEmail,
                    email: companyEmail,
                    passwordHash,
                    mustChangePassword: true,
                    userRoles: {
                        create: roles.map((role) => ({
                            roleId: role.id,
                            assignedBy: actor.id
                        }))
                    }
                }
            });
            const employee = await tx.employee.create({
                data: {
                    employeeCode: dto.employeeCode,
                    fullName: dto.fullName,
                    companyEmail,
                    avatarUrl: dto.avatarUrl,
                    personalEmail: dto.personalEmail,
                    phone: dto.phone,
                    birthDate,
                    hireDate: dto.hireDate ? (0, utils_1.toDateOnly)(dto.hireDate) : undefined,
                    status: dto.status ?? client_1.EmployeeStatus.ACTIVE,
                    departmentId: dto.departmentId,
                    positionId: dto.positionId,
                    careerLevel: dto.careerLevel ?? client_1.CareerLevel.FRESHER,
                    userId: user.id
                },
                include: employeeInclude
            });
            return { employee, user };
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_USER_FOR_EMPLOYEE",
            entityType: "User",
            entityId: result.user.id,
            newValue: { username: result.user.username, email: result.user.email },
            context
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_EMPLOYEE",
            entityType: "Employee",
            entityId: result.employee.id,
            newValue: {
                employeeCode: result.employee.employeeCode,
                fullName: result.employee.fullName,
                companyEmail: result.employee.companyEmail
            },
            context
        });
        return {
            employeeId: result.employee.id,
            userId: result.user.id,
            employeeCode: result.employee.employeeCode,
            fullName: result.employee.fullName,
            companyEmail: result.employee.companyEmail,
            username: result.user.username,
            defaultPassword,
            mustChangePassword: true,
            employee: this.safeEmployee(result.employee)
        };
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id }),
            include: employeeInclude
        });
        if (!oldValue) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        const effectiveDepartmentId = dto.departmentId === undefined ? oldValue.departmentId : dto.departmentId;
        const effectivePositionId = dto.positionId === undefined ? oldValue.positionId : dto.positionId;
        const references = await this.ensureDepartmentAndPosition(effectiveDepartmentId, effectivePositionId);
        if (dto.companyEmail && dto.companyEmail.toLowerCase() !== oldValue.companyEmail) {
            await this.ensureEmailAvailable(dto.companyEmail.toLowerCase(), id, oldValue.userId);
        }
        const employee = await this.prisma.$transaction(async (tx) => {
            await tx.employee.update({
                where: { id },
                data: {
                    employeeCode: dto.employeeCode,
                    fullName: dto.fullName,
                    companyEmail: dto.companyEmail?.toLowerCase(),
                    avatarUrl: dto.avatarUrl,
                    personalEmail: dto.personalEmail,
                    phone: dto.phone,
                    birthDate: dto.birthDate ? (0, utils_1.toDateOnly)(dto.birthDate) : undefined,
                    hireDate: dto.hireDate ? (0, utils_1.toDateOnly)(dto.hireDate) : undefined,
                    status: dto.status,
                    departmentId: dto.departmentId,
                    positionId: dto.positionId,
                    careerLevel: dto.careerLevel
                }
            });
            if (dto.companyEmail && oldValue.userId) {
                await tx.user.update({
                    where: { id: oldValue.userId },
                    data: {
                        username: dto.companyEmail.toLowerCase(),
                        email: dto.companyEmail.toLowerCase()
                    }
                });
            }
            if (dto.positionId !== undefined && oldValue.userId) {
                await this.syncManagerRoleForPosition(tx, oldValue.userId, references.position, actor.id);
            }
            return tx.employee.findUniqueOrThrow({
                where: { id },
                include: employeeInclude
            });
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_EMPLOYEE",
            entityType: "Employee",
            entityId: id,
            oldValue: this.safeEmployee(oldValue),
            newValue: this.safeEmployee(employee),
            context
        });
        return this.safeEmployee(employee);
    }
    async updateSelf(user, dto, context) {
        if (!user.employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        const employee = await this.prisma.employee.update({
            where: { id: user.employeeId },
            data: {
                avatarUrl: dto.avatarUrl,
                personalEmail: dto.personalEmail,
                phone: dto.phone
            },
            include: employeeInclude
        });
        await this.audit.log({
            userId: user.id,
            action: "UPDATE_EMPLOYEE_SELF",
            entityType: "Employee",
            entityId: employee.id,
            newValue: { personalEmail: dto.personalEmail, phone: dto.phone },
            context
        });
        return this.safeEmployee(employee);
    }
    async softDelete(id, actor, context) {
        const oldValue = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
            include: employeeInclude
        });
        if (!oldValue) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        const employee = await this.prisma.$transaction(async (tx) => {
            const deleted = await tx.employee.update({
                where: { id },
                data: {
                    status: client_1.EmployeeStatus.INACTIVE,
                    deletedAt: new Date()
                },
                include: employeeInclude
            });
            if (oldValue.userId) {
                await tx.user.update({
                    where: { id: oldValue.userId },
                    data: {
                        isActive: false,
                        deletedAt: deleted.deletedAt,
                        refreshTokenHash: null,
                        refreshTokenVersion: { increment: 1 }
                    }
                });
            }
            await tx.employeeManager.updateMany({
                where: {
                    isActive: true,
                    OR: [{ employeeId: id }, { managerId: id }]
                },
                data: {
                    isActive: false,
                    endDate: (0, utils_1.toDateOnly)(deleted.deletedAt ?? new Date())
                }
            });
            return deleted;
        });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_EMPLOYEE",
            entityType: "Employee",
            entityId: id,
            oldValue: this.safeEmployee(oldValue),
            context
        });
        return this.safeEmployee(employee);
    }
    async resetPassword(id, actor, context) {
        const employee = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id }),
            include: { user: true }
        });
        if (!employee || !employee.user) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        const defaultPassword = (0, utils_1.formatDateDdMmYyyy)(employee.birthDate);
        const passwordHash = await bcrypt.hash(defaultPassword, this.saltRounds());
        await this.prisma.user.update({
            where: { id: employee.user.id },
            data: {
                passwordHash,
                mustChangePassword: true,
                refreshTokenHash: null,
                refreshTokenVersion: { increment: 1 }
            }
        });
        await this.audit.log({
            userId: actor.id,
            action: "RESET_EMPLOYEE_PASSWORD",
            entityType: "Employee",
            entityId: id,
            context
        });
        return {
            employeeId: employee.id,
            userId: employee.user.id,
            username: employee.user.username,
            defaultPassword,
            mustChangePassword: true
        };
    }
    async setUserActive(id, isActive, actor, context) {
        const employee = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id }),
            include: { user: true }
        });
        if (!employee?.user) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee user not found", "USER_NOT_FOUND");
        }
        const user = await this.prisma.user.update({
            where: { id: employee.user.id },
            data: {
                isActive,
                refreshTokenHash: isActive ? undefined : null,
                refreshTokenVersion: isActive ? undefined : { increment: 1 }
            }
        });
        await this.audit.log({
            userId: actor.id,
            action: isActive ? "UNLOCK_EMPLOYEE_USER" : "LOCK_EMPLOYEE_USER",
            entityType: "User",
            entityId: user.id,
            newValue: { isActive },
            context
        });
        return (0, utils_1.omitSensitiveUser)(user);
    }
    buildWhere(query) {
        return {
            AND: [
                (0, prisma_where_1.currentEmployeeWhere)(),
                ...(query.search
                    ? [
                        {
                            OR: [
                                { fullName: { contains: query.search, mode: "insensitive" } },
                                { employeeCode: { contains: query.search, mode: "insensitive" } },
                                { companyEmail: { contains: query.search, mode: "insensitive" } }
                            ]
                        }
                    ]
                    : [])
            ],
            departmentId: query.departmentId,
            positionId: query.positionId,
            status: query.status,
            careerLevel: query.careerLevel
        };
    }
    async ensureEmailAvailable(companyEmail, employeeId, userId) {
        const employee = await this.prisma.employee.findFirst({
            where: {
                companyEmail,
                id: employeeId ? { not: employeeId } : undefined
            },
            select: { id: true }
        });
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: companyEmail }, { username: companyEmail }],
                id: userId ? { not: userId } : undefined
            },
            select: { id: true }
        });
        if (employee || user) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Company email already exists", "VALIDATION_ERROR");
        }
    }
    async ensureDepartmentAndPosition(departmentId, positionId) {
        let position;
        if (departmentId) {
            const department = await this.prisma.department.findFirst({
                where: { id: departmentId, deletedAt: null },
                select: { id: true }
            });
            if (!department) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Department not found", "DEPARTMENT_NOT_FOUND");
            }
        }
        if (positionId) {
            position = await this.prisma.position.findFirst({
                where: { id: positionId, deletedAt: null },
                select: { id: true, code: true, name: true, departmentId: true }
            });
            if (!position) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Position not found", "POSITION_NOT_FOUND");
            }
            if (!departmentId) {
                throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Department is required when selecting a position", "VALIDATION_ERROR");
            }
            if (position.departmentId && position.departmentId !== departmentId) {
                throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Position does not belong to selected department", "VALIDATION_ERROR");
            }
        }
        else if (positionId === null) {
            position = null;
        }
        return { position };
    }
    async rolesForPosition(position) {
        const roleNames = (0, position_role_1.isManagerPosition)(position)
            ? ["EMPLOYEE", "MANAGER"]
            : ["EMPLOYEE"];
        const roles = await this.prisma.role.findMany({
            where: { name: { in: roleNames } },
            select: { id: true, name: true }
        });
        if (roles.length !== roleNames.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
        }
        return roles;
    }
    async syncManagerRoleForPosition(tx, userId, position, actorId) {
        const managerRole = await tx.role.findUnique({
            where: { name: "MANAGER" },
            select: { id: true }
        });
        if (!managerRole) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
        }
        if ((0, position_role_1.isManagerPosition)(position)) {
            await tx.userRole.upsert({
                where: { userId_roleId: { userId, roleId: managerRole.id } },
                create: { userId, roleId: managerRole.id, assignedBy: actorId },
                update: {}
            });
            return;
        }
        await tx.userRole.deleteMany({
            where: { userId, roleId: managerRole.id }
        });
    }
    safeEmployee(employee) {
        const cloned = JSON.parse(JSON.stringify(employee));
        if (cloned.user) {
            cloned.user = (0, utils_1.omitSensitiveUser)(cloned.user);
        }
        return cloned;
    }
    saltRounds() {
        return Number(this.config.get("BCRYPT_SALT_ROUNDS") ?? 10);
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        access_control_service_1.AccessControlService])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map