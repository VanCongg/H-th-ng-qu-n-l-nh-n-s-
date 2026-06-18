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
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const prisma_where_1 = require("../common/prisma-where");
const roleInclude = {
    rolePermissions: {
        include: { permission: true }
    },
    _count: {
        select: { userRoles: { where: { user: (0, prisma_where_1.currentUserWhere)() } } }
    }
};
let RolesService = class RolesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    findAll() {
        return this.prisma.role.findMany({
            include: roleInclude,
            orderBy: { name: "asc" }
        });
    }
    async findOne(id) {
        const role = await this.prisma.role.findUnique({
            where: { id },
            include: roleInclude
        });
        if (!role) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
        }
        return role;
    }
    async create(dto, actor, context) {
        this.ensureAllowedRoleName(dto.name);
        const permissionIds = this.uniqueIds(dto.permissionIds);
        await this.ensurePermissions(permissionIds);
        const role = await this.prisma.role.create({
            data: {
                name: dto.name,
                description: dto.description,
                rolePermissions: permissionIds.length
                    ? {
                        create: permissionIds.map((permissionId) => ({ permissionId }))
                    }
                    : undefined
            },
            include: roleInclude
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_ROLE",
            entityType: "Role",
            entityId: role.id,
            newValue: role,
            context
        });
        return role;
    }
    async update(id, dto, actor, context) {
        if (dto.name) {
            this.ensureAllowedRoleName(dto.name);
        }
        const permissionIds = dto.permissionIds ? this.uniqueIds(dto.permissionIds) : undefined;
        await this.ensurePermissions(permissionIds);
        const oldValue = await this.findOne(id);
        const role = await this.prisma.$transaction(async (tx) => {
            if (permissionIds) {
                await tx.rolePermission.deleteMany({ where: { roleId: id } });
                if (permissionIds.length) {
                    await tx.rolePermission.createMany({
                        data: permissionIds.map((permissionId) => ({
                            roleId: id,
                            permissionId
                        })),
                        skipDuplicates: true
                    });
                }
            }
            return tx.role.update({
                where: { id },
                data: {
                    name: dto.name,
                    description: dto.description
                },
                include: roleInclude
            });
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_ROLE",
            entityType: "Role",
            entityId: id,
            oldValue,
            newValue: role,
            context
        });
        return role;
    }
    async remove(id, actor, context) {
        const role = await this.findOne(id);
        if (role.isSystem) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "System role cannot be deleted", "VALIDATION_ERROR");
        }
        await this.prisma.role.delete({ where: { id } });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_ROLE",
            entityType: "Role",
            entityId: id,
            oldValue: role,
            context
        });
        return role;
    }
    async assignPermission(roleId, dto, actor, context) {
        await this.findOne(roleId);
        const permission = await this.prisma.permission.findUnique({
            where: { id: dto.permissionId }
        });
        if (!permission) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Permission not found", "PERMISSION_NOT_FOUND");
        }
        await this.prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: { roleId, permissionId: dto.permissionId }
            },
            create: { roleId, permissionId: dto.permissionId },
            update: {}
        });
        await this.audit.log({
            userId: actor.id,
            action: "ASSIGN_PERMISSION",
            entityType: "Role",
            entityId: roleId,
            newValue: { permissionId: dto.permissionId },
            context
        });
        return this.findOne(roleId);
    }
    async removePermission(roleId, permissionId, actor, context) {
        await this.findOne(roleId);
        const relation = await this.prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId, permissionId } },
            select: { roleId: true }
        });
        if (!relation) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Role permission not found", "ROLE_PERMISSION_NOT_FOUND");
        }
        await this.prisma.rolePermission.delete({
            where: { roleId_permissionId: { roleId, permissionId } }
        });
        await this.audit.log({
            userId: actor.id,
            action: "REMOVE_PERMISSION",
            entityType: "Role",
            entityId: roleId,
            oldValue: { permissionId },
            context
        });
        return this.findOne(roleId);
    }
    ensureAllowedRoleName(name) {
        if (name.trim().toUpperCase() === "HR_MANAGER") {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "HR_MANAGER role is not supported in phase 1", "VALIDATION_ERROR");
        }
    }
    async ensurePermissions(permissionIds) {
        if (!permissionIds?.length) {
            return;
        }
        const existing = await this.prisma.permission.findMany({
            where: { id: { in: permissionIds } },
            select: { id: true }
        });
        if (existing.length !== permissionIds.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Permission not found", "PERMISSION_NOT_FOUND");
        }
    }
    uniqueIds(ids) {
        return Array.from(new Set(ids ?? []));
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RolesService);
//# sourceMappingURL=roles.service.js.map