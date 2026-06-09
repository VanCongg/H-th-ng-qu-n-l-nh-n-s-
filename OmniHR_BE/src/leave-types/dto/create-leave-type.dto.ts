import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateLeaveTypeDto {
  @IsString()
  @MaxLength(80)
  code: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  annualAllowance?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
