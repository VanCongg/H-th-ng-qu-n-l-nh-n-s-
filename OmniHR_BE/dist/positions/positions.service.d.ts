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
    findAll(search?: string, departmentId?: number): Prisma.PrismaPromise<({
        department: {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            managerId: number | null;
            parentId: number | null;
        } | null;
        _count: {
            employees: number;
        };
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    })[]>;
    findOne(id: number): Promise<{
        department: {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            managerId: number | null;
            parentId: number | null;
        } | null;
        _count: {
            employees: number;
        };
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    }>;
    create(dto: CreatePositionDto, actor: AuthUser, context?: RequestContext): Promise<{
        department: {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            managerId: number | null;
            parentId: number | null;
        } | null;
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    }>;
    update(id: number, dto: UpdatePositionDto, actor: AuthUser, context?: RequestContext): Promise<{
        department: {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            managerId: number | null;
            parentId: number | null;
        } | null;
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    }>;
    softDelete(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        departmentId: number | null;
    }>;
    private ensureDepartment;
}
