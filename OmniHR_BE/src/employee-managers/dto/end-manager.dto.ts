// Dữ liệu kết thúc quan hệ quản lý: ngày kết thúc.

import { IsDateString, IsOptional } from "class-validator";

export class EndManagerDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
