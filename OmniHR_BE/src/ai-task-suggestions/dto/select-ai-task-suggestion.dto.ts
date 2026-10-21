// Dữ liệu chọn ứng viên: id dòng ứng viên trong gợi ý và ghi chú.

import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";

export class SelectAiTaskSuggestionDto {
  @Type(() => Number)
  @IsInt()
  suggestionItemId: number;

  @IsOptional()
  @IsString()
  note?: string;
}
