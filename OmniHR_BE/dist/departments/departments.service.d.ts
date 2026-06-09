import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
type DepartmentTreeNode = Prisma.DepartmentGetPayload<{}> & {
    children: DepartmentTreeNode[];
};
export declare class DepartmentsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    findAll(search?: string): Prisma.PrismaPromise<({
        _count: {
            employees: number;
        };
        parent: {
            id: number;
            createdAt: Date;
            isActive: boolean;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            code: string;
            parentId: number | null;
        } | null;
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    })[]>;
    tree(): Promise<DepartmentTreeNode[]>;
    findOne(id: number): Promise<{
        _count: {
            employees: number;
        };
        parent: {
            id: number;
            createdAt: Date;
            isActive: boolean;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            code: string;
            parentId: number | null;
        } | null;
        children: {
            id: number;
            createdAt: Date;
            isActive: boolean;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            code: string;
            parentId: number | null;
        }[];
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    }>;
    create(dto: CreateDepartmentDto, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    }>;
    update(id: number, dto: UpdateDepartmentDto, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    }>;
    softDelete(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    }>;
    private ensureParent;
    private ensureNoParentCycle;
}
export {};
