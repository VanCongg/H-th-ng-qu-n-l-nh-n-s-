// Dữ liệu hủy đơn nghỉ: lý do (hiện cho quản lý khi hủy đơn đã duyệt).

import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelLeaveRequestDto {
  /** Why an approved leave should be withdrawn; shown to the manager deciding. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
