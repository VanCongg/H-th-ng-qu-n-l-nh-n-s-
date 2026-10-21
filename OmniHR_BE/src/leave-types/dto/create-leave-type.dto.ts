// Dữ liệu tạo loại nghỉ: mã, tên, số ngày mỗi năm, có hưởng lương không, đang dùng không.

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

  /** Whether an approved leave of this type counts as a paid work day. */
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
