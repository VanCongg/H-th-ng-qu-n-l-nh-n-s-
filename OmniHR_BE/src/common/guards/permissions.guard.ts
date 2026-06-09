import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiError } from "../api-error";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthUser } from "../types";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
    }

    if (user.roles.includes("ADMIN")) {
      return true;
    }

    const allowed = requiredPermissions.some((permission) =>
      user.permissions.includes(permission)
    );
    if (!allowed) {
      throw new ApiError(HttpStatus.FORBIDDEN, "Permission denied", "FORBIDDEN");
    }

    return true;
  }
}
