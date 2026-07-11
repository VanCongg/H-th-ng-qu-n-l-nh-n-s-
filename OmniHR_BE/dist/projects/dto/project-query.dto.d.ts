import { ProjectStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class ProjectQueryDto extends PaginationQueryDto {
    status?: ProjectStatus;
    departmentId?: number;
    managerId?: number;
}
