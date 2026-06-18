import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsInt()
  departmentId?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
