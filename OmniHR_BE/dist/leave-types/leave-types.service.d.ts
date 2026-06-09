import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";
export declare class LeaveTypesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }>;
    create(dto: CreateLeaveTypeDto, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }>;
    update(id: number, dto: UpdateLeaveTypeDto, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }>;
    remove(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        code: string;
        annualAllowance: number | null;
    }>;
}
