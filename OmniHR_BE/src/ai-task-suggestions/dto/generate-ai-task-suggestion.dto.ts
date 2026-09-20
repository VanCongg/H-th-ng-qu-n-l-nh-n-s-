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
