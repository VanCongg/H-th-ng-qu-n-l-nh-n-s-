// Dữ liệu từ chối đơn nghỉ: lý do.

import { IsString, MaxLength } from "class-validator";

export class RejectLeaveRequestDto {
  @IsString()
  @MaxLength(1000)
  rejectionReason: string;
}
