import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { TeamMemberRole } from "@prisma/client";

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsEnum(TeamMemberRole)
  role?: TeamMemberRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
