import { IsOptional, IsString, MaxLength } from "class-validator";

export class ChatbotCancelActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
