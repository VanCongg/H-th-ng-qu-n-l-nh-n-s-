import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
