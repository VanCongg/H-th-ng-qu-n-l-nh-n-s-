// Nghiệp vụ xác thực.
// - Mật khẩu băm bằng bcrypt; refresh token cũng chỉ lưu bản băm.
// - Refresh token có số phiên bản (refreshTokenVersion): dùng lại token cũ bị coi là bị lộ,
//   mọi phiên bị thu hồi và ghi audit REFRESH_TOKEN_REUSE_DETECTED.
// - Thông tin người dùng (roles, permissions) được cache trên Redis vì cần ở mọi request.

import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { EmployeeStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAccessPayload, JwtRefreshPayload } from "./jwt-payload.type";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { VerificationPurpose } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { VerificationService } from "../verification/verification.service";
import { AUTH_USER_TTL_SECONDS, cacheKeys } from "../redis/cache-keys";
import { CacheService } from "../redis/cache.service";

/** Wrong current passwords allowed on the change form within the window. */
export const PASSWORD_CHANGE_MAX_FAILURES = 5;
export const PASSWORD_CHANGE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Whether a new password gives away who it belongs to: the username, or the
 * name part of the email, inside it (case ignored). Short names - three
 * letters or fewer - are left out, or "an" would forbid half the dictionary.
 */
// Mật khẩu mới không được chứa username hoặc phần tên của email.
export function passwordContainsIdentity(password: string, username: string, email: string) {
  const lower = password.toLowerCase();
  return [username, email.split("@")[0]]
    .map((part) => part.trim().toLowerCase())
    .some((part) => part.length > 3 && lower.includes(part));
}

type SignInCandidate = {
  isActive: boolean;
  deletedAt: Date | null;
  employee?: { status: EmployeeStatus } | null;
};

/**
 * An account works while it is active and not deleted, and while the person
 * behind it still works here: a terminated employee's login stops with the
 * contract, even if nobody went on to disable the user account as well.
 */
// Tài khoản đăng nhập được khi đang hoạt động, chưa bị xóa, và nhân viên chưa nghỉ việc.
export function canSignIn(user: SignInCandidate) {
  return (
    user.isActive &&
    !user.deletedAt &&
    user.employee?.status !== EmployeeStatus.TERMINATED
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly notifications: NotificationsService,
    private readonly verification: VerificationService
  ) {}

  /**
   * Wrong current passwords per user, for the change form. Kept in Redis so
   * every API instance sees the same count, and in memory too, so the limit
   * still holds when Redis is down.
   */
  private readonly localPasswordFailures = new Map<number, number[]>();

  /**
   * The account a sign-in name points at: the username or email first, then
   * the employee code (e.g. "IT011"), so a username that happens to equal
   * someone else's code still finds its own account.
   */
  // Tìm tài khoản theo username hoặc email trước, sau đó theo mã nhân viên (vd. "IT011").
  private async findAccount(identifier: string) {
    const name = identifier.trim();
    const include = { employee: { select: { status: true } } } as const;
    return (
      (await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: name, mode: "insensitive" } },
            { email: { equals: name, mode: "insensitive" } }
          ]
        },
        include
      })) ??
      (await this.prisma.user.findFirst({
        where: {
          employee: {
            is: { employeeCode: { equals: name, mode: "insensitive" }, deletedAt: null }
          }
        },
        include
      }))
    );
  }

  // Đăng nhập: tìm tài khoản -> kiểm tra còn được đăng nhập -> so mật khẩu bcrypt
  // -> cập nhật lần đăng nhập cuối -> cấp token -> ghi audit LOGIN.
  // Sai tài khoản hay sai mật khẩu đều trả cùng một lỗi để không lộ tài khoản nào tồn tại.
  async login(dto: LoginDto, context?: RequestContext) {
    const user = await this.findAccount(dto.usernameOrEmail);

    if (!user) {
      throw new ApiError(
        HttpStatus.UNAUTHORIZED,
        "Invalid credentials",
        "INVALID_CREDENTIALS"
      );
    }

    if (!canSignIn(user)) {
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

  // Làm mới token: token phải khớp phiên bản và bản băm đang lưu.
  // Không khớp (token cũ bị dùng lại) thì xóa refresh token, tăng phiên bản -> mọi thiết bị phải đăng nhập lại.
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
      where: { id: payload.sub },
      include: { employee: { select: { status: true } } }
    });

    if (!user || !canSignIn(user)) {
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

  // Đăng xuất: xóa refresh token đang lưu.
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

  // Trả thông tin người dùng hiện tại (đã nạp roles, permissions).
  async me(user: AuthUser) {
    const authUser = await this.hydrateAuthUser(user.id);
    if (!authUser) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
    }

    return authUser;
  }

  /**
   * Changes the signed-in user's password. The current password must be right
   * (five wrong tries in fifteen minutes lock the form for the rest of that
   * window, per account, so a leaked session cannot guess its way in); the new
   * one must differ from it and not contain the username or email. Every other
   * session is signed out; this one gets fresh tokens back, so the device the
   * change was made on stays signed in. The owner is told, in case it was not them.
   */
  // Đổi mật khẩu: sai mật khẩu hiện tại 5 lần trong 15 phút thì khóa form; cần mã OTP;
  // mọi phiên khác bị đăng xuất, thiết bị hiện tại nhận token mới; gửi email báo cho chủ tài khoản.
  async changePassword(user: AuthUser, dto: ChangePasswordDto, context?: RequestContext) {
    if ((await this.recentPasswordFailures(user.id)).length >= PASSWORD_CHANGE_MAX_FAILURES) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        "Too many wrong passwords; try again in 15 minutes",
        "PASSWORD_CHANGE_LOCKED"
      );
    }

    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      dbUser.passwordHash
    );
    if (!isPasswordValid) {
      await this.recordPasswordFailure(user.id);
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Current password is invalid",
        "CURRENT_PASSWORD_INVALID"
      );
    }
    if (await bcrypt.compare(dto.newPassword, dbUser.passwordHash)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "The new password must differ from the current one",
        "PASSWORD_REUSED"
      );
    }
    if (passwordContainsIdentity(dto.newPassword, dbUser.username, dbUser.email)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "The new password must not contain your username or email",
        "PASSWORD_CONTAINS_IDENTITY"
      );
    }

    // Last, once everything else is right, so a typo elsewhere does not burn the code.
    await this.verification.consume(user.id, VerificationPurpose.PASSWORD_CHANGE, dto.otpCode);

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
    await this.clearPasswordFailures(user.id);

    // mustChangePassword just flipped, and a stale copy would keep prompting.
    await this.cache.del(cacheKeys.authUser(user.id));

    await this.audit.log({
      userId: user.id,
      action: "CHANGE_PASSWORD",
      entityType: "User",
      entityId: user.id,
      context
    });
    await this.notifications.create(
      user.id,
      "PASSWORD_CHANGED",
      "Password changed",
      "Your password was changed. If this was not you, contact an administrator right away.",
      "User",
      user.id
    );

    const authUser = await this.hydrateAuthUser(user.id);
    if (!authUser) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
    }
    return {
      message: "Password changed successfully",
      user: authUser,
      ...(await this.issueTokens(authUser))
    };
  }

  /**
   * Starts a forgotten-password reset: a code goes to the email the account
   * is registered with. The answer is the same whether or not the account
   * exists, is disabled, or was sent a code a moment ago - otherwise this
   * form would tell anyone which names have accounts.
   */
  // Quên mật khẩu: gửi mã về email của tài khoản. Luôn trả cùng một câu trả lời
  // dù tài khoản có tồn tại hay không, để không ai dò được tài khoản.
  async forgotPassword(dto: ForgotPasswordDto, context?: RequestContext) {
    const account = await this.findAccount(dto.identifier);
    if (account && canSignIn(account)) {
      try {
        await this.verification.requestCode({ id: account.id }, VerificationPurpose.PASSWORD_RESET, null, context);
      } catch (error) {
        // A code asked for twice in a minute is still on its way: say nothing.
        if (!(error instanceof ApiError) || error.errorCode !== "VERIFICATION_RESEND_TOO_SOON") {
          throw error;
        }
      }
    }
    return { message: "If the account exists, a code was sent to its email" };
  }

  /**
   * Sets a new password with the emailed code. Every session of the account
   * is signed out; the person signs in again with the new password.
   */
  // Đặt lại mật khẩu bằng mã email; mọi phiên của tài khoản bị đăng xuất.
  async resetPassword(dto: ResetPasswordDto, context?: RequestContext) {
    const account = await this.findAccount(dto.identifier);
    if (!account || !canSignIn(account)) {
      // The same answer as a wrong code: nothing about whether it exists.
      throw new ApiError(HttpStatus.BAD_REQUEST, "The verification code is wrong", "VERIFICATION_CODE_INVALID");
    }
    if (await bcrypt.compare(dto.newPassword, account.passwordHash)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "The new password must differ from the current one",
        "PASSWORD_REUSED"
      );
    }
    if (passwordContainsIdentity(dto.newPassword, account.username, account.email)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "The new password must not contain your username or email",
        "PASSWORD_CONTAINS_IDENTITY"
      );
    }
    await this.verification.consume(account.id, VerificationPurpose.PASSWORD_RESET, dto.otpCode);

    await this.prisma.user.update({
      where: { id: account.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, this.saltRounds()),
        mustChangePassword: false,
        refreshTokenHash: null,
        refreshTokenVersion: { increment: 1 }
      }
    });
    await this.clearPasswordFailures(account.id);
    await this.cache.del(cacheKeys.authUser(account.id));
    await this.audit.log({
      userId: account.id,
      action: "RESET_PASSWORD_BY_EMAIL",
      entityType: "User",
      entityId: account.id,
      context
    });
    await this.notifications.create(
      account.id,
      "PASSWORD_CHANGED",
      "Password changed",
      "Your password was changed. If this was not you, contact an administrator right away.",
      "User",
      account.id
    );
    return { message: "Password reset; sign in with the new password" };
  }

  // Số lần nhập sai mật khẩu hiện tại gần đây (Redis + bộ nhớ, để vẫn chặn được khi Redis lỗi).
  private async recentPasswordFailures(userId: number) {
    const since = Date.now() - PASSWORD_CHANGE_WINDOW_MS;
    const shared = (await this.cache.get<number[]>(cacheKeys.passwordChangeFailures(userId))) ?? [];
    const local = this.localPasswordFailures.get(userId) ?? [];
    const recent = (list: number[]) => list.filter((time) => time > since);
    const fromShared = recent(shared);
    const fromLocal = recent(local);
    return fromShared.length >= fromLocal.length ? fromShared : fromLocal;
  }

  private async recordPasswordFailure(userId: number) {
    const failures = [...(await this.recentPasswordFailures(userId)), Date.now()];
    this.localPasswordFailures.set(userId, failures);
    await this.cache.set(
      cacheKeys.passwordChangeFailures(userId),
      failures,
      Math.ceil(PASSWORD_CHANGE_WINDOW_MS / 1000)
    );
  }

  private async clearPasswordFailures(userId: number) {
    this.localPasswordFailures.delete(userId);
    await this.cache.del(cacheKeys.passwordChangeFailures(userId));
  }

  /**
   * Runs on every authenticated request, via JwtStrategy.validate, and joins
   * four tables to do it - so it reads from Redis first.
   *
   * Only a hydrated user is cached; a null (inactive, deleted, missing) goes
   * back to the database every time, so a newly activated account is not
   * locked out for a whole TTL. Callers that change a user's roles, status or
   * password drop `cacheKeys.authUser(id)` themselves.
   */
  // Nạp người dùng kèm roles + permissions, đọc qua Redis cache. Chạy ở MỌI request đã đăng nhập.
  // Kết quả null (khóa, xóa) không được cache. Ai đổi role / trạng thái / mật khẩu phải xóa cache này.
  async hydrateAuthUser(userId: number): Promise<AuthUser | null> {
    return this.cache.wrap(
      cacheKeys.authUser(userId),
      AUTH_USER_TTL_SECONDS,
      () => this.loadAuthUser(userId),
    );
  }

  // Đọc DB: User -> UserRole -> Role -> RolePermission -> Permission.
  private async loadAuthUser(userId: number): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: { select: { id: true, deletedAt: true, status: true } },
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

    if (!user || !canSignIn(user)) {
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

  // Cấp access token (ngắn hạn) + refresh token (dài hạn), tăng phiên bản refresh, lưu bản băm.
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
