// Dữ liệu gắn permission vào role.

import { IsInt } from "class-validator";

export class AssignPermissionDto {
  @IsInt()
  permissionId: number;
}
