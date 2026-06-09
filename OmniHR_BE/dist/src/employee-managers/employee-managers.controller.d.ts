import { AuthUser, RequestContext } from "../common/types";
import { AssignManagerDto } from "./dto/assign-manager.dto";
import { EndManagerDto } from "./dto/end-manager.dto";
import { EmployeeManagersService } from "./employee-managers.service";
export declare class EmployeeManagersController {
    private readonly employeeManagersService;
    constructor(employeeManagersService: EmployeeManagersService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        employee: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
        manager: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
    } & {
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date | null;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
    })[]>;
    findByEmployee(employeeId: number): Promise<({
        employee: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
        manager: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
    } & {
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date | null;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
    })[]>;
    findSubordinates(managerId: number): Promise<({
        employee: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
        manager: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
    } & {
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date | null;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
    })[]>;
    assign(dto: AssignManagerDto, user: AuthUser, context: RequestContext): Promise<{
        employee: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
        manager: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
    } & {
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date | null;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
    }>;
    end(id: number, dto: EndManagerDto, user: AuthUser, context: RequestContext): Promise<{
        employee: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
        manager: {
            department: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                parentId: number | null;
            } | null;
            position: {
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                name: string;
                code: string;
                level: number;
            } | null;
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            employeeCode: string;
            fullName: string;
            companyEmail: string;
            personalEmail: string | null;
            phone: string | null;
            birthDate: Date;
            hireDate: Date | null;
            status: import(".prisma/client").$Enums.EmployeeStatus;
            departmentId: number | null;
            positionId: number | null;
            userId: number | null;
        };
    } & {
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date | null;
        employeeId: number;
        managerId: number;
        managerType: import(".prisma/client").$Enums.ManagerType;
    }>;
}
