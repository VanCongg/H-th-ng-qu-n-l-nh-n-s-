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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/services/audit.service");
const api_error_1 = require("../common/api-error");
const utils_1 = require("../common/utils");
const prisma_where_1 = require("../common/prisma-where");
const position_role_1 = require("../common/position-role");
const userInclude = {
    employee: {
        include: {
            department: true,
            position: true,
            employeeSkills: {
                include: { skill: true },
                orderBy: [{ skill: { code: "asc" } }]
            }
        }
    },
    userRoles: {
        include: {
            role: true
        }
    }
};
let UsersService = class UsersService {
    prisma;
    config;
    audit;
    constructor(prisma, config, audit) {
        this.prisma = prisma;
        this.config = config;
        this.audit = audit;
    }
    async findAll(query) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const where = {
            ...(0, prisma_where_1.currentUserWhere)(),
            ...(query.search
                ? {
                    OR: [
                        { username: { contains: query.search, mode: "insensitive" } },
                        { email: { contains: query.search, mode: "insensitive" } },
                        {
                            employee: {
                                is: {
                                    OR: [
                                        { fullName: { contains: query.search, mode: "insensitive" } },
                                        { employeeCode: { contains: query.search, mode: "insensitive" } },
                                        { companyEmail: { contains: query.search, mode: "insensitive" } },
                                        {
                                            department: {
                                                is: {
                                                    OR: [
                                                        { code: { contains: query.search, mode: "insensitive" } },
                                                        { name: { contains: query.search, mode: "insensitive" } }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            position: {
                                                is: {
                                                    OR: [
                                                        { code: { contains: query.search, mode: "insensitive" } },
                                                        { name: { contains: query.search, mode: "insensitive" } }
                                                    ]
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
                : {})
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                include: userInclude,
                orderBy: { createdAt: "desc" },
                skip,
                take
            }),
            this.prisma.user.count({ where })
        ]);
        return {
            items: items.map((item) => (0, utils_1.omitSensitiveUser)(item)),
            meta: { total, page, limit }
        };
    }
    async findOne(id) {
        const user = await this.prisma.user.findFirst({
            where: (0, prisma_where_1.currentUserWhere)({ id }),
            include: userInclude
        });
        if (!user) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
        }
        return (0, utils_1.omitSensitiveUser)(user);
    }
    async create(dto, actor, context) {
        const roleIds = this.uniqueIds(dto.roleIds);
        const email = dto.email.toLowerCase();
        await this.ensureRoles(roleIds);
        const requiresEmployeeProfile = await this.requiresEmployeeProfile(roleIds);
        await this.ensureEmployeeProfileForCreate(dto.employeeProfile, email, roleIds, requiresEmployeeProfile);
        const passwordHash = await bcrypt.hash(dto.password, this.saltRounds());
        const user = await this.prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    username: dto.username,
                    email,
                    passwordHash,
                    isActive: dto.isActive ?? true,
                    mustChangePassword: dto.mustChangePassword ?? true,
                    userRoles: roleIds.length
                        ? {
                            create: roleIds.map((roleId) => ({
                                roleId,
                                assignedBy: actor.id
                            }))
                        }
                        : undefined
                }
            });
            if (dto.employeeProfile && requiresEmployeeProfile) {
                await tx.employee.create({
                    data: this.employeeProfileCreateData(dto.employeeProfile, email, createdUser.id)
                });
            }
            return tx.user.findUniqueOrThrow({
                where: { id: createdUser.id },
                include: userInclude
            });
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_USER",
            entityType: "User",
            entityId: user.id,
            newValue: { username: user.username, email: user.email },
            context
        });
        return (0, utils_1.omitSensitiveUser)(user);
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.prisma.user.findFirst({
            where: (0, prisma_where_1.currentUserWhere)({ id }),
            include: userInclude
        });
        if (!oldValue) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
        }
        const roleIds = dto.roleIds ? this.uniqueIds(dto.roleIds) : undefined;
        const effectiveRoleIds = roleIds ?? oldValue.userRoles.map((userRole) => userRole.roleId);
        const email = dto.email?.toLowerCase();
        await this.ensureRoles(roleIds);
        const requiresEmployeeProfile = await this.requiresEmployeeProfile(effectiveRoleIds);
        await this.ensureEmployeeProfileForUpdate(dto.employeeProfile, oldValue.employee, oldValue.employee ? email : email ?? oldValue.email, effectiveRoleIds, requiresEmployeeProfile);
        const passwordHash = dto.password
            ? await bcrypt.hash(dto.password, this.saltRounds())
            : undefined;
        const user = await this.prisma.$transaction(async (tx) => {
            if (roleIds) {
                await tx.userRole.deleteMany({ where: { userId: id } });
                if (roleIds.length) {
                    await tx.userRole.createMany({
                        data: roleIds.map((roleId) => ({
                            userId: id,
                            roleId,
                            assignedBy: actor.id
                        })),
                        skipDuplicates: true
                    });
                }
            }
            await tx.user.update({
                where: { id },
                data: {
                    username: dto.username,
                    email,
                    passwordHash,
                    isActive: dto.isActive,
                    mustChangePassword: dto.mustChangePassword,
                    refreshTokenHash: dto.password || dto.isActive === false ? null : undefined,
                    refreshTokenVersion: dto.password || dto.isActive === false ? { increment: 1 } : undefined
                }
            });
            if (oldValue.employee && email) {
                await tx.employee.update({
                    where: { id: oldValue.employee.id },
                    data: { companyEmail: email }
                });
            }
            if (dto.employeeProfile && (oldValue.employee || requiresEmployeeProfile)) {
                if (oldValue.employee) {
                    await tx.employee.update({
                        where: { id: oldValue.employee.id },
                        data: this.employeeProfileUpdateData(dto.employeeProfile)
                    });
                }
                else {
                    const profile = this.requireCompleteEmployeeProfile(dto.employeeProfile);
                    await tx.employee.create({
                        data: this.employeeProfileCreateData(profile, email ?? oldValue.email, id)
                    });
                }
            }
            return tx.user.findUniqueOrThrow({
                where: { id },
                include: userInclude
            });
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_USER",
            entityType: "User",
            entityId: user.id,
            oldValue: (0, utils_1.omitSensitiveUser)(oldValue),
            newValue: (0, utils_1.omitSensitiveUser)(user),
            context
        });
        return (0, utils_1.omitSensitiveUser)(user);
    }
    async softDelete(id, actor, context) {
        const oldValue = await this.prisma.user.findFirst({
            where: (0, prisma_where_1.currentUserWhere)({ id }),
            include: { employee: true }
        });
        if (!oldValue) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
        }
        const deletedAt = new Date();
        const user = await this.prisma.$transaction(async (tx) => {
            const deletedUser = await tx.user.update({
                where: { id },
                data: {
                    isActive: false,
                    deletedAt,
                    refreshTokenHash: null,
                    refreshTokenVersion: { increment: 1 }
                }
            });
            if (oldValue.employee && !oldValue.employee.deletedAt) {
                await tx.employee.update({
                    where: { id: oldValue.employee.id },
                    data: {
                        status: client_1.EmployeeStatus.INACTIVE,
                        deletedAt
                    }
                });
                await tx.employeeManager.updateMany({
                    where: {
                        isActive: true,
                        OR: [
                            { employeeId: oldValue.employee.id },
                            { managerId: oldValue.employee.id }
                        ]
                    },
                    data: {
                        isActive: false,
                        endDate: (0, utils_1.toDateOnly)(deletedAt)
                    }
                });
            }
            return deletedUser;
        });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_USER",
            entityType: "User",
            entityId: id,
            oldValue: (0, utils_1.omitSensitiveUser)(oldValue),
            context
        });
        return (0, utils_1.omitSensitiveUser)(user);
    }
    async assignRole(userId, dto, actor, context) {
        await this.ensureUser(userId);
        await this.ensureRole(dto.roleId);
        await this.prisma.userRole.upsert({
            where: { userId_roleId: { userId, roleId: dto.roleId } },
            create: { userId, roleId: dto.roleId, assignedBy: actor.id },
            update: { assignedBy: actor.id }
        });
        await this.audit.log({
            userId: actor.id,
            action: "ASSIGN_ROLE",
            entityType: "User",
            entityId: userId,
            newValue: { roleId: dto.roleId },
            context
        });
        return this.findOne(userId);
    }
    async removeRole(userId, roleId, actor, context) {
        await this.ensureUser(userId);
        const role = await this.ensureRole(roleId);
        const relation = await this.prisma.userRole.findUnique({
            where: { userId_roleId: { userId, roleId } },
            select: { userId: true }
        });
        if (!relation) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User role not found", "USER_ROLE_NOT_FOUND");
        }
        if (role.name === "MANAGER") {
            const user = await this.prisma.user.findFirst({
                where: (0, prisma_where_1.currentUserWhere)({ id: userId }),
                select: {
                    employee: {
                        select: {
                            position: { select: { code: true, name: true } }
                        }
                    }
                }
            });
            await this.ensureManagerRoleCanBeRemoved(user?.employee?.position);
        }
        await this.prisma.userRole.delete({
            where: { userId_roleId: { userId, roleId } }
        });
        await this.audit.log({
            userId: actor.id,
            action: "REMOVE_ROLE",
            entityType: "User",
            entityId: userId,
            oldValue: { roleId },
            context
        });
        return this.findOne(userId);
    }
    async resetPassword(id, dto, actor, context) {
        await this.ensureUser(id);
        const passwordHash = await bcrypt.hash(dto.password, this.saltRounds());
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                passwordHash,
                mustChangePassword: dto.mustChangePassword ?? true,
                refreshTokenHash: null,
                refreshTokenVersion: { increment: 1 }
            },
            include: userInclude
        });
        await this.audit.log({
            userId: actor.id,
            action: "RESET_USER_PASSWORD",
            entityType: "User",
            entityId: id,
            context
        });
        return (0, utils_1.omitSensitiveUser)(user);
    }
    async ensureEmployeeProfileForCreate(profile, companyEmail, roleIds, requiresEmployeeProfile) {
        if (!requiresEmployeeProfile) {
            return;
        }
        if (!profile) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Employee profile is required", "VALIDATION_ERROR");
        }
        const references = await this.ensureDepartmentAndPosition(profile.departmentId, profile.positionId);
        await this.ensureManagerPositionRole(references.position, roleIds);
        await this.ensureEmployeeCodeAvailable(profile.employeeCode);
        await this.ensureEmployeeEmailAvailable(companyEmail);
    }
    async ensureEmployeeProfileForUpdate(profile, employee, companyEmail, roleIds, requiresEmployeeProfile) {
        if (!requiresEmployeeProfile && !employee) {
            return;
        }
        if (companyEmail &&
            (employee || profile) &&
            employee?.companyEmail !== companyEmail) {
            await this.ensureEmployeeEmailAvailable(companyEmail, employee?.id);
        }
        let effectivePosition = employee?.position;
        if (!profile) {
            if (requiresEmployeeProfile && !employee) {
                throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Employee profile is required", "VALIDATION_ERROR");
            }
            await this.ensureManagerPositionRole(effectivePosition, roleIds);
            return;
        }
        const effectiveDepartmentId = profile.departmentId === undefined
            ? employee?.departmentId
            : profile.departmentId;
        const effectivePositionId = profile.positionId === undefined ? employee?.positionId : profile.positionId;
        const references = await this.ensureDepartmentAndPosition(effectiveDepartmentId, effectivePositionId);
        if (profile.positionId !== undefined) {
            effectivePosition = references.position;
        }
        await this.ensureManagerPositionRole(effectivePosition, roleIds);
        if (employee) {
            if (profile.employeeCode && profile.employeeCode !== employee.employeeCode) {
                await this.ensureEmployeeCodeAvailable(profile.employeeCode, employee.id);
            }
            return;
        }
        const completeProfile = this.requireCompleteEmployeeProfile(profile);
        await this.ensureEmployeeCodeAvailable(completeProfile.employeeCode);
        await this.ensureEmployeeEmailAvailable(companyEmail ?? "");
    }
    requireCompleteEmployeeProfile(profile) {
        if (!profile.employeeCode ||
            !profile.fullName ||
            !profile.birthDate ||
            !profile.departmentId ||
            !profile.positionId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Employee profile requires employee code, full name, birth date, department, and position", "VALIDATION_ERROR");
        }
        return {
            employeeCode: profile.employeeCode,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            birthDate: profile.birthDate,
            hireDate: profile.hireDate,
            status: profile.status,
            departmentId: profile.departmentId,
            positionId: profile.positionId
        };
    }
    employeeProfileCreateData(profile, companyEmail, userId) {
        return {
            employeeCode: profile.employeeCode,
            fullName: profile.fullName,
            companyEmail,
            avatarUrl: profile.avatarUrl,
            birthDate: (0, utils_1.toDateOnly)(profile.birthDate),
            hireDate: profile.hireDate ? (0, utils_1.toDateOnly)(profile.hireDate) : undefined,
            status: profile.status ?? client_1.EmployeeStatus.ACTIVE,
            departmentId: profile.departmentId,
            positionId: profile.positionId,
            careerLevel: profile.careerLevel ?? client_1.CareerLevel.FRESHER,
            userId
        };
    }
    employeeProfileUpdateData(profile) {
        return {
            employeeCode: profile.employeeCode,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            birthDate: profile.birthDate ? (0, utils_1.toDateOnly)(profile.birthDate) : undefined,
            hireDate: profile.hireDate ? (0, utils_1.toDateOnly)(profile.hireDate) : undefined,
            status: profile.status,
            departmentId: profile.departmentId,
            positionId: profile.positionId,
            careerLevel: profile.careerLevel
        };
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
        return { position };
    }
    async ensureManagerPositionRole(position, roleIds) {
        if (!(0, position_role_1.isManagerPosition)(position)) {
            return;
        }
        const managerRole = await this.prisma.role.findUnique({
            where: { name: "MANAGER" },
            select: { id: true }
        });
        if (!managerRole) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
        }
        if (!roleIds.includes(managerRole.id)) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Manager position requires MANAGER role", "VALIDATION_ERROR");
        }
    }
    ensureManagerRoleCanBeRemoved(position) {
        if (!(0, position_role_1.isManagerPosition)(position)) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Manager position requires MANAGER role", "VALIDATION_ERROR");
    }
    async ensureEmployeeCodeAvailable(employeeCode, employeeId) {
        const employee = await this.prisma.employee.findFirst({
            where: {
                employeeCode,
                id: employeeId ? { not: employeeId } : undefined
            },
            select: { id: true }
        });
        if (employee) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Employee code already exists", "VALIDATION_ERROR");
        }
    }
    async ensureEmployeeEmailAvailable(companyEmail, employeeId) {
        if (!companyEmail) {
            return;
        }
        const employee = await this.prisma.employee.findFirst({
            where: {
                companyEmail,
                id: employeeId ? { not: employeeId } : undefined
            },
            select: { id: true }
        });
        if (employee) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Company email already exists", "VALIDATION_ERROR");
        }
    }
    async ensureUser(id) {
        const user = await this.prisma.user.findFirst({
            where: (0, prisma_where_1.currentUserWhere)({ id }),
            select: { id: true }
        });
        if (!user) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
        }
    }
    async ensureRole(id) {
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (!role) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
        }
        return role;
    }
    async ensureRoles(roleIds) {
        if (!roleIds?.length) {
            return;
        }
        const existing = await this.prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { id: true }
        });
        if (existing.length !== roleIds.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
        }
    }
    async requiresEmployeeProfile(roleIds) {
        if (!roleIds.length) {
            return true;
        }
        const roles = await this.prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { name: true }
        });
        return roles.some((role) => role.name !== "ADMIN");
    }
    uniqueIds(ids) {
        return Array.from(new Set(ids ?? []));
    }
    saltRounds() {
        return Number(this.config.get("BCRYPT_SALT_ROUNDS") ?? 10);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        audit_service_1.AuditService])
], UsersService);
//# sourceMappingURL=users.service.js.map