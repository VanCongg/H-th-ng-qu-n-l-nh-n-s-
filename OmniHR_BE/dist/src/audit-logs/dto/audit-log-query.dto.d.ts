import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
export declare class AuditLogQueryDto extends PaginationQueryDto {
    userId?: number;
    action?: string;
    entityType?: string;
    fromDate?: string;
    toDate?: string;
}
