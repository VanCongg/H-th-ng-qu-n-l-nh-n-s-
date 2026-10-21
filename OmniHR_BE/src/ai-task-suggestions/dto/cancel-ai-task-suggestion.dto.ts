import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelAiTaskSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
