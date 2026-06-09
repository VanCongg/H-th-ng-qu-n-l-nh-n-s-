import { PrismaService } from "../../prisma/prisma.service";
import { RequestContext } from "../types";
type AuditPayload = {
    userId?: number | null;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    oldValue?: unknown;
    newValue?: unknown;
    context?: RequestContext;
};
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(payload: AuditPayload): Promise<void>;
    private toJson;
}
export {};
