import { CareerLevel, EmployeeStatus } from "@prisma/client";
export declare class CreateUserEmployeeProfileDto {
    employeeCode: string;
    fullName: string;
    avatarUrl?: string | null;
    birthDate: string;
    hireDate?: string;
    status?: EmployeeStatus;
    departmentId: number;
    positionId: number;
    careerLevel?: CareerLevel;
}
export declare class UpdateUserEmployeeProfileDto {
    employeeCode?: string;
    fullName?: string;
    avatarUrl?: string | null;
    birthDate?: string;
    hireDate?: string;
    status?: EmployeeStatus;
    departmentId?: number;
    positionId?: number;
    careerLevel?: CareerLevel;
}
