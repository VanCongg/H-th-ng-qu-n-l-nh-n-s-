import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiError } from "../api-error";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AuthUser } from "../types";
import { HttpStatus } from "@nestjs/common";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized", "UNAUTHORIZED");
    }

    const allowed = requiredRoles.some((role) => user.roles.includes(role));
    if (!allowed) {
      throw new ApiError(HttpStatus.FORBIDDEN, "Forbidden", "FORBIDDEN");
    }

    return true;
  }
}
