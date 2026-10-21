// Dữ liệu hủy bản nháp của chatbot: lý do (tối đa 500 ký tự).

import { IsOptional, IsString, MaxLength } from "class-validator";

export class ChatbotCancelActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
