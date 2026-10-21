// Dữ liệu gán role cho tài khoản.

import { IsInt } from "class-validator";

export class AssignRoleDto {
  @IsInt()
  roleId: number;
}
