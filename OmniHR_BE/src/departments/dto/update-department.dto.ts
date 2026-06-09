import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateDepartmentDto {
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
  parentId?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
