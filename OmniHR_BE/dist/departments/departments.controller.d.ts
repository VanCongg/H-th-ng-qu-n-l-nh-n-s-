import { AuthUser, RequestContext } from "../common/types";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { DepartmentsService } from "./departments.service";
export declare class DepartmentsController {
    private readonly departmentsService;
    constructor(departmentsService: DepartmentsService);
    findAll(search?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    tree(): Promise<({
        deletedAt: Date | null;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        managerId: number | null;
        parentId: number | null;
    } & {
        children: ({
            deletedAt: Date | null;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            managerId: number | null;
            parentId: number | null;
        } & any)[];
    })[]>;
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
    create(dto: CreateDepartmentDto, user: AuthUser, context: RequestContext): Promise<{
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
    update(id: number, dto: UpdateDepartmentDto, user: AuthUser, context: RequestContext): Promise<{
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
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
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
}
