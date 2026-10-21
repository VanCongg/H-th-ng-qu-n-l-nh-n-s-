// Dữ liệu tạo vị trí: mã, tên, phòng ban, đang hoạt động.

import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePositionDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
