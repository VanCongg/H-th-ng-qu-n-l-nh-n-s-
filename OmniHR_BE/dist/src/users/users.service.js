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
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/services/audit.service");
const api_error_1 = require("../common/api-error");
const utils_1 = require("../common/utils");
const userInclude = {
    employee: {
        select: {
            id: true,
            employeeCode: true,
            fullName: true,
            companyEmail: true
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
            deletedAt: null,
            ...(query.search
                ? {
                    OR: [
                        { username: { contains: query.search, mode: "insensitive" } },
                        { email: { contains: query.search, mode: "insensitive" } }
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
            where: { id, deletedAt: null },
            include: userInclude
        });
        if (!user) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
        }
        return (0, utils_1.omitSensitiveUser)(user);
    }
    async create(dto, actor, context) {
        const passwordHash = await bcrypt.hash(dto.password, this.saltRounds());
        const user = await this.prisma.user.create({
            data: {
                username: dto.username,
                email: dto.email,
                passwordHash,
                mustChangePassword: dto.mustChangePassword ?? true,
                userRoles: dto.roleIds?.length
                    ? {
                        create: dto.roleIds.map((roleId) => ({
                            roleId,
                            assignedBy: actor.id
                        }))
                    }
                    : undefined
            },
            include: userInclude
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
            where: { id, deletedAt: null },
            include: userInclude
        });
        if (!oldValue) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
        }
        const passwordHash = dto.password
            ? await bcrypt.hash(dto.password, this.saltRounds())
            : undefined;
        const user = await this.prisma.$transaction(async (tx) => {
            if (dto.roleIds) {
                await tx.userRole.deleteMany({ where: { userId: id } });
                if (dto.roleIds.length) {
                    await tx.userRole.createMany({
                        data: dto.roleIds.map((roleId) => ({
                            userId: id,
                            roleId,
                            assignedBy: actor.id
                        })),
                        skipDuplicates: true
                    });
                }
            }
            return tx.user.update({
                where: { id },
                data: {
                    username: dto.username,
                    email: dto.email,
                    passwordHash,
                    isActive: dto.isActive,
                    mustChangePassword: dto.mustChangePassword,
                    refreshTokenHash: dto.password || dto.isActive === false ? null : undefined,
                    refreshTokenVersion: dto.password || dto.isActive === false ? { increment: 1 } : undefined
                },
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
            where: { id, deletedAt: null }
        });
        if (!oldValue) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
        }
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                isActive: false,
                deletedAt: new Date(),
                refreshTokenHash: null,
                refreshTokenVersion: { increment: 1 }
            }
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
    async ensureUser(id) {
        const user = await this.prisma.user.findFirst({
            where: { id, deletedAt: null },
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