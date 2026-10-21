// @Roles(...): route yêu cầu có ít nhất một trong các role này (RolesGuard kiểm tra).

import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
