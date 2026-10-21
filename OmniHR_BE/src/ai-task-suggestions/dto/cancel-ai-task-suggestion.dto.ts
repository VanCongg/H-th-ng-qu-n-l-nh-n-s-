// Dữ liệu hủy gợi ý AI: lý do (tối đa 500 ký tự).

import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelAiTaskSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
