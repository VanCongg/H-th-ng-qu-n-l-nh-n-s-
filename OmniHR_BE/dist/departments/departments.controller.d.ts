import { AuthUser, RequestContext } from "../common/types";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { DepartmentsService } from "./departments.service";
export declare class DepartmentsController {
    private readonly departmentsService;
    constructor(departmentsService: DepartmentsService);
    findAll(search?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    tree(): Promise<({
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    } & {
        children: ({
            id: number;
            createdAt: Date;
            isActive: boolean;
            updatedAt: Date;
            deletedAt: Date | null;
            name: string;
            code: string;
            parentId: number | null;
        } & any)[];
    })[]>;
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
    create(dto: CreateDepartmentDto, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    }>;
    update(id: number, dto: UpdateDepartmentDto, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    }>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        deletedAt: Date | null;
        name: string;
        code: string;
        parentId: number | null;
    }>;
}
