import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreatePositionDto } from "./dto/create-position.dto";
import { UpdatePositionDto } from "./dto/update-position.dto";
export declare class PositionsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    findAll(search?: string): Prisma.PrismaPromise<({
        _count: {
            employees: number;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    })[]>;
    findOne(id: number): Promise<{
        _count: {
            employees: number;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    }>;
    create(dto: CreatePositionDto, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    }>;
    update(id: number, dto: UpdatePositionDto, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    }>;
    softDelete(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        level: number;
    }>;
}
