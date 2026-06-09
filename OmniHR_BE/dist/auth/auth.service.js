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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const utils_1 = require("../common/utils");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    audit;
    constructor(prisma, jwt, config, audit) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
    }
    async login(dto, context) {
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [{ username: dto.usernameOrEmail }, { email: dto.usernameOrEmail }],
                deletedAt: null
            }
        });
        if (!user || !user.isActive) {
            throw new api_error_1.ApiError(common_1.HttpStatus.UNAUTHORIZED, "Invalid credentials", user ? "USER_INACTIVE" : "INVALID_CREDENTIALS");
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new api_error_1.ApiError(common_1.HttpStatus.UNAUTHORIZED, "Invalid credentials", "INVALID_CREDENTIALS");
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });
        const authUser = await this.hydrateAuthUser(user.id);
        if (!authUser) {
            throw new api_error_1.ApiError(common_1.HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
        }
        const tokens = await this.issueTokens(authUser);
        await this.audit.log({
            userId: user.id,
            action: "LOGIN",
            entityType: "User",
            entityId: user.id,
            context
        });
        return {
            user: authUser,
            ...tokens
        };
    }
    async refresh(dto, context) {
        let payload;
        try {
            payload = await this.jwt.verifyAsync(dto.refreshToken, {
                secret: this.config.get("JWT_REFRESH_SECRET") ??
                    "change_me_refresh_secret"
            });
        }
        catch {
            throw new api_error_1.ApiError(common_1.HttpStatus.UNAUTHORIZED, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub }
        });
        if (!user || !user.isActive || user.deletedAt) {
            throw new api_error_1.ApiError(common_1.HttpStatus.UNAUTHORIZED, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
        }
        const tokenLooksCurrent = user.refreshTokenHash && payload.version === user.refreshTokenVersion;
        const tokenMatches = tokenLooksCurrent &&
            (await bcrypt.compare(dto.refreshToken, user.refreshTokenHash));
        if (!tokenMatches) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    refreshTokenHash: null,
                    refreshTokenVersion: { increment: 1 }
                }
            });
            await this.audit.log({
                userId: user.id,
                action: "REFRESH_TOKEN_REUSE_DETECTED",
                entityType: "User",
                entityId: user.id,
                context
            });
            throw new api_error_1.ApiError(common_1.HttpStatus.UNAUTHORIZED, "Refresh token reused or invalid", "REFRESH_TOKEN_REUSED");
        }
        const authUser = await this.hydrateAuthUser(user.id);
        if (!authUser) {
            throw new api_error_1.ApiError(common_1.HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
        }
        const tokens = await this.issueTokens(authUser);
        return {
            user: authUser,
            ...tokens
        };
    }
    async logout(user, context) {
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                refreshTokenHash: null,
                refreshTokenVersion: { increment: 1 }
            }
        });
        await this.audit.log({
            userId: user.id,
            action: "LOGOUT",
            entityType: "User",
            entityId: user.id,
            context
        });
        return { message: "Logged out" };
    }
    async me(user) {
        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                employee: {
                    include: {
                        department: true,
                        position: true
                    }
                },
                userRoles: {
                    include: { role: true }
                }
            }
        });
        return dbUser ? (0, utils_1.omitSensitiveUser)(dbUser) : user;
    }
    async changePassword(user, dto) {
        const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
        if (!dbUser) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
        }
        const isPasswordValid = await bcrypt.compare(dto.currentPassword, dbUser.passwordHash);
        if (!isPasswordValid) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Current password is invalid", "INVALID_CREDENTIALS");
        }
        const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds());
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                mustChangePassword: false,
                refreshTokenHash: null,
                refreshTokenVersion: { increment: 1 }
            }
        });
        return { message: "Password changed successfully" };
    }
    async hydrateAuthUser(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                employee: { select: { id: true } },
                userRoles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: {
                                    include: { permission: true }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!user || !user.isActive || user.deletedAt) {
            return null;
        }
        const roles = user.userRoles.map((userRole) => userRole.role.name);
        const permissions = Array.from(new Set(user.userRoles.flatMap((userRole) => userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code))));
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            roles,
            permissions,
            employeeId: user.employee?.id ?? null,
            mustChangePassword: user.mustChangePassword
        };
    }
    async issueTokens(user) {
        const current = await this.prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { refreshTokenVersion: true }
        });
        const nextRefreshVersion = current.refreshTokenVersion + 1;
        const accessPayload = {
            sub: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles,
            permissions: user.permissions,
            employeeId: user.employeeId
        };
        const refreshPayload = {
            sub: user.id,
            version: nextRefreshVersion
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwt.signAsync(accessPayload, {
                secret: this.config.get("JWT_ACCESS_SECRET") ?? "change_me_access_secret",
                expiresIn: (this.config.get("JWT_ACCESS_EXPIRES_IN") ??
                    "15m")
            }),
            this.jwt.signAsync(refreshPayload, {
                secret: this.config.get("JWT_REFRESH_SECRET") ??
                    "change_me_refresh_secret",
                expiresIn: (this.config.get("JWT_REFRESH_EXPIRES_IN") ??
                    "7d")
            })
        ]);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                refreshTokenHash: await bcrypt.hash(refreshToken, this.saltRounds()),
                refreshTokenVersion: nextRefreshVersion
            }
        });
        return {
            accessToken,
            refreshToken,
            tokenType: "Bearer"
        };
    }
    saltRounds() {
        return Number(this.config.get("BCRYPT_SALT_ROUNDS") ?? 10);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map