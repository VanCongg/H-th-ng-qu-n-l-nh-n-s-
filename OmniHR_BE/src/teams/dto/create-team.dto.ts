// Dữ liệu tạo nhóm: phòng ban, trưởng nhóm, mã, tên, mô tả, đang hoạt động, danh sách thành viên.

import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class CreateTeamDto {
  @Type(() => Number)
  @IsInt()
  departmentId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leadId?: number;

  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  memberIds?: number[];
}
