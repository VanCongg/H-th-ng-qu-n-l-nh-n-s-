import { CareerLevel, EmployeeStatus } from "@prisma/client";
export declare class UpdateEmployeeDto {
    employeeCode?: string;
    fullName?: string;
    companyEmail?: string;
    avatarUrl?: string | null;
    personalEmail?: string;
    phone?: string;
    birthDate?: string;
    hireDate?: string;
    status?: EmployeeStatus;
    departmentId?: number | null;
    positionId?: number | null;
    careerLevel?: CareerLevel;
}
