import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class ChatbotMessageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000, {
    message: "Tin nhắn quá dài. Vui lòng rút gọn nội dung.",
  })
  message: string;
}
