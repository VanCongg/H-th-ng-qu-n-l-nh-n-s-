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
