import { IsInt } from "class-validator";

export class AssignPermissionDto {
  @IsInt()
  permissionId: number;
}
