import { AuditLogsService } from "./audit-logs.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";
export declare class AuditLogsController {
    private readonly auditLogsService;
    constructor(auditLogsService: AuditLogsService);
    findAll(query: AuditLogQueryDto): Promise<{
        items: ({
            user: {
                id: number;
                username: string;
                email: string;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            userId: number | null;
            action: string;
            entityType: string;
            entityId: string | null;
            oldValue: import("@prisma/client/runtime/library").JsonValue | null;
            newValue: import("@prisma/client/runtime/library").JsonValue | null;
            ipAddress: string | null;
            userAgent: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
}
