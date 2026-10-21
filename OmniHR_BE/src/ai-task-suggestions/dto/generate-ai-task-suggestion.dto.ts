// Tùy chọn khi tạo gợi ý AI: số ứng viên (1-20, mặc định 5), có xét lịch nghỉ không,
// có tính cả bản thân người giao không, có tính đơn nghỉ đang chờ duyệt không.

import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class GenerateAiTaskSuggestionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeAvailability?: boolean = true;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSelf?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includePendingLeave?: boolean = true;
}
