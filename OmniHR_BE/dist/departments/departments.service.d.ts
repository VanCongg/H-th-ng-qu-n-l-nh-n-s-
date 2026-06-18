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
        manager: ({
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
            position: {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
            } | null;
        } & {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            userId: number | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            avatarUrl: string | null;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
            careerLevel: import(".prisma/client").$Enums.CareerLevel;
        }) | null;
        _count: {
            employees: number;
            teams: number;
        };
        parent: {
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
        managerId: number | null;
        parentId: number | null;
    })[]>;
    tree(): Promise<DepartmentTreeNode[]>;
    findOne(id: number): Promise<{
        manager: ({
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
            position: {
                deletedAt: Date | null;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                departmentId: number | null;
            } | null;
        } & {
            deletedAt: Date | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            userId: number | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            avatarUrl: string | null;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
            careerLevel: import(".prisma/client").$Enums.CareerLevel;
        }) | null;
        _count: {
            employees: number;
            teams: number;
        };
        parent: {
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
        children: {
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            managerId: number | null;
            parentId: number | null;
        }[];
    } & {
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        managerId: number | null;
        parentId: number | null;
    }>;
    create(dto: CreateDepartmentDto, actor: AuthUser, context?: RequestContext): Promise<{
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        managerId: number | null;
        parentId: number | null;
    }>;
    update(id: number, dto: UpdateDepartmentDto, actor: AuthUser, context?: RequestContext): Promise<{
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        managerId: number | null;
        parentId: number | null;
    }>;
    softDelete(id: number, actor: AuthUser, context?: RequestContext): Promise<{
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        managerId: number | null;
        parentId: number | null;
    }>;
    private ensureParent;
    private ensureNoParentCycle;
    private ensureManagerInDepartment;
}
export {};
