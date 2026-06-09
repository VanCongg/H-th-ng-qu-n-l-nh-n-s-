import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { AssignManagerDto } from "./dto/assign-manager.dto";
import { EndManagerDto } from "./dto/end-manager.dto";
export declare class EmployeeManagersService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        employee: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
        manager: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
        startDate: Date;
        endDate: Date | null;
    })[]>;
    findByEmployee(employeeId: number): Promise<({
        employee: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
        manager: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
        startDate: Date;
        endDate: Date | null;
    })[]>;
    findSubordinates(managerId: number): Promise<({
        employee: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
        manager: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
        startDate: Date;
        endDate: Date | null;
    })[]>;
    assign(dto: AssignManagerDto, actor: AuthUser, context?: RequestContext): Promise<{
        employee: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
        manager: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
        startDate: Date;
        endDate: Date | null;
    }>;
    end(id: number, dto: EndManagerDto, actor: AuthUser, context?: RequestContext): Promise<{
        employee: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
        manager: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
        startDate: Date;
        endDate: Date | null;
    }>;
    findOne(id: number): Promise<{
        employee: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
        manager: {
            department: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                createdAt: Date;
                isActive: boolean;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            userId: number | null;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            departmentId: number | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            positionId: number | null;
        };
    } & {
        id: number;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
        startDate: Date;
        endDate: Date | null;
    }>;
    private activeRelationWhere;
    private ensureNoActiveRelation;
    private ensureNoActiveDirectManager;
    private ensureEmployee;
}
