import { TaskPriority, TaskStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class TaskQueryDto extends PaginationQueryDto {
    projectId?: number;
    departmentId?: number;
    teamId?: number;
    assigneeId?: number;
    status?: TaskStatus;
    priority?: TaskPriority;
    fromDate?: string;
    toDate?: string;
}
