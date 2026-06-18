import { TaskAssignmentType } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class TaskAssignmentQueryDto extends PaginationQueryDto {
    taskId?: number;
    assigneeId?: number;
    assignmentType?: TaskAssignmentType;
}
