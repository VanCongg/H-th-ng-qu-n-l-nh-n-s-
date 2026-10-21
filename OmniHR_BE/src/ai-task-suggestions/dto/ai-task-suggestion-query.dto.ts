import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional } from "class-validator";
import { AiTaskSuggestionStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class AiTaskSuggestionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskId?: number;

  @IsOptional()
  @IsEnum(AiTaskSuggestionStatus)
  status?: AiTaskSuggestionStatus;
}
