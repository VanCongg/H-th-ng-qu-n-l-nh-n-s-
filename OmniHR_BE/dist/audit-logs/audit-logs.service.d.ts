import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";
export declare class AuditLogsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(query: AuditLogQueryDto): Promise<{
        items: ({
            user: {
                id: number;
                username: string;
                email: string;
            } | null;
        } & {
            userId: number | null;
            action: string;
            entityType: string;
            id: number;
            entityId: string | null;
            oldValue: Prisma.JsonValue | null;
            newValue: Prisma.JsonValue | null;
            ipAddress: string | null;
            userAgent: string | null;
            createdAt: Date;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    }>;
}
