import { EmployeeStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class EmployeeQueryDto extends PaginationQueryDto {
    departmentId?: number;
    positionId?: number;
    status?: EmployeeStatus;
}
