import { LeaveRequestStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class LeaveRequestQueryDto extends PaginationQueryDto {
    status?: LeaveRequestStatus;
    employeeId?: number;
    departmentId?: number;
    leaveTypeId?: number;
    fromDate?: string;
    toDate?: string;
}
