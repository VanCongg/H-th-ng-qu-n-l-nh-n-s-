import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional } from "class-validator";
import { TeamMemberRole } from "@prisma/client";

export class AddTeamMemberDto {
  @Type(() => Number)
  @IsInt()
  employeeId: number;

  @IsOptional()
  @IsEnum(TeamMemberRole)
  role?: TeamMemberRole;
}
