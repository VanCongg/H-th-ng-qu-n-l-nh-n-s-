import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  annualAllowance?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
