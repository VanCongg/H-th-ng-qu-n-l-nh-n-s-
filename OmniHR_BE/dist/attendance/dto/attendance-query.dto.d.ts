import { AttendanceRecordType } from "@prisma/client";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class AttendanceQueryDto extends PaginationQueryDto {
    employeeId?: number;
    departmentId?: number;
    fromDate?: string;
    toDate?: string;
    recordType?: AttendanceRecordType;
}
