import { AiTaskSuggestionStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class AiTaskSuggestionQueryDto extends PaginationQueryDto {
    taskId?: number;
    status?: AiTaskSuggestionStatus;
}
