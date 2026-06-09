import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreatePolicyDto } from "./dto/create-policy.dto";
import { UpdatePolicyDto } from "./dto/update-policy.dto";
export declare class PoliciesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    findAll(): Prisma.PrismaPromise<{
        action: string;
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        effect: string;
        condition: Prisma.JsonValue | null;
    }[]>;
    findOne(id: number): Promise<{
        action: string;
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        effect: string;
        condition: Prisma.JsonValue | null;
    }>;
    create(dto: CreatePolicyDto, actor: AuthUser, context?: RequestContext): Promise<{
        action: string;
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        effect: string;
        condition: Prisma.JsonValue | null;
    }>;
    update(id: number, dto: UpdatePolicyDto, actor: AuthUser, context?: RequestContext): Promise<{
        action: string;
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        effect: string;
        condition: Prisma.JsonValue | null;
    }>;
    remove(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        action: string;
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        name: string;
        description: string | null;
        resource: string;
        effect: string;
        condition: Prisma.JsonValue | null;
    }>;
}
