import { AuthUser, RequestContext } from "../common/types";
import { CreateEmployeeSkillDto } from "./dto/create-employee-skill.dto";
import { UpdateEmployeeSkillDto } from "./dto/update-employee-skill.dto";
import { EmployeeSkillsService } from "./employee-skills.service";
export declare class EmployeeSkillsController {
    private readonly employeeSkillsService;
    constructor(employeeSkillsService: EmployeeSkillsService);
    findByEmployee(employeeId: number, user: AuthUser): Promise<({
        employee: {
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
        };
        skill: {
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            category: string | null;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        employeeId: number;
        note: string | null;
        skillId: number;
        yearsExperience: import("@prisma/client/runtime/library").Decimal | null;
        proficiency: import(".prisma/client").$Enums.SkillProficiency | null;
        lastUsedAt: Date | null;
    })[]>;
    create(employeeId: number, dto: CreateEmployeeSkillDto, user: AuthUser, context: RequestContext): Promise<{
        employee: {
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
        };
        skill: {
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            category: string | null;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        employeeId: number;
        note: string | null;
        skillId: number;
        yearsExperience: import("@prisma/client/runtime/library").Decimal | null;
        proficiency: import(".prisma/client").$Enums.SkillProficiency | null;
        lastUsedAt: Date | null;
    }>;
    update(id: number, dto: UpdateEmployeeSkillDto, user: AuthUser, context: RequestContext): Promise<{
        employee: {
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
        };
        skill: {
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            category: string | null;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        employeeId: number;
        note: string | null;
        skillId: number;
        yearsExperience: import("@prisma/client/runtime/library").Decimal | null;
        proficiency: import(".prisma/client").$Enums.SkillProficiency | null;
        lastUsedAt: Date | null;
    }>;
    remove(id: number, user: AuthUser, context: RequestContext): Promise<{
        employee: {
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
        };
        skill: {
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            description: string | null;
            category: string | null;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        employeeId: number;
        note: string | null;
        skillId: number;
        yearsExperience: import("@prisma/client/runtime/library").Decimal | null;
        proficiency: import(".prisma/client").$Enums.SkillProficiency | null;
        lastUsedAt: Date | null;
    }>;
}
