import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtAccessPayload, JwtRefreshPayload } from "./jwt-payload.type";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService
  ) {}

  async login(dto: LoginDto, context?: RequestContext) {
    const usernameOrEmail = dto.usernameOrEmail.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: usernameOrEmail, mode: "insensitive" } },
          { email: { equals: usernameOrEmail, mode: "insensitive" } }
        ]
      }
    });

    if (!user) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        "Invalid credentials",
        "INVALID_CREDENTIALS"
      );
    }

    if (!user.isActive || user.deletedAt) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        "Account is inactive or deleted",
        "USER_INACTIVE"
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        "Invalid credentials",
        "INVALID_CREDENTIALS"
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const authUser = await this.hydrateAuthUser(user.id);
    if (!authUser) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
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

  async refresh(dto: RefreshTokenDto, context?: RequestContext) {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(dto.refreshToken, {
        secret: this.requiredConfig("JWT_REFRESH_SECRET")
      });
    } catch {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        "Invalid refresh token",
        "INVALID_REFRESH_TOKEN"
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        "Invalid refresh token",
        "INVALID_REFRESH_TOKEN"
      );
    }

    const tokenLooksCurrent =
      user.refreshTokenHash && payload.version === user.refreshTokenVersion;
    const tokenMatches =
      tokenLooksCurrent &&
      (await bcrypt.compare(dto.refreshToken, user.refreshTokenHash as string));

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

      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        "Refresh token reused or invalid",
        "REFRESH_TOKEN_REUSED"
      );
    }

    const authUser = await this.hydrateAuthUser(user.id);
    if (!authUser) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
    }

    const tokens = await this.issueTokens(authUser);

    return {
      user: authUser,
      ...tokens
    };
  }

  async logout(user: AuthUser, context?: RequestContext) {
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

  async me(user: AuthUser) {
    const authUser = await this.hydrateAuthUser(user.id);
    if (!authUser) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
    }

    return authUser;
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      dbUser.passwordHash
    );
    if (!isPasswordValid) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Current password is invalid",
        "INVALID_CREDENTIALS"
      );
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

  async hydrateAuthUser(userId: number): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: { select: { id: true, deletedAt: true } },
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
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map(
            (rolePermission) => rolePermission.permission.code
          )
        )
      )
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles,
      permissions,
      employeeId: user.employee && !user.employee.deletedAt ? user.employee.id : null,
      mustChangePassword: user.mustChangePassword
    };
  }

  private async issueTokens(user: AuthUser) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { refreshTokenVersion: true }
    });
    const nextRefreshVersion = current.refreshTokenVersion + 1;

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      employeeId: user.employeeId
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      version: nextRefreshVersion
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.requiredConfig("JWT_ACCESS_SECRET"),
        expiresIn: (this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ??
          "15m") as any
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.requiredConfig("JWT_REFRESH_SECRET"),
        expiresIn: (this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ??
          "7d") as any
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

  private saltRounds() {
    return Number(this.config.get<string>("BCRYPT_SALT_ROUNDS") ?? 10);
  }

  private requiredConfig(key: string) {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Missing required config: ${key}`);
    }
    return value;
  }
}
